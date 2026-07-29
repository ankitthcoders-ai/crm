"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const shared_1 = require("@crm/shared");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const ROLES = [
    { name: 'SUPER_ADMIN', displayName: 'Super Admin', description: 'Full system access' },
];
async function main() {
    console.log('Seeding database...');
    const permissionKeys = new Set();
    Object.values(shared_1.ROLE_PERMISSIONS).forEach((perms) => perms.forEach((p) => permissionKeys.add(p)));
    for (const key of permissionKeys) {
        const module = key.split(':')[0];
        await prisma.permission.upsert({
            where: { key },
            update: {},
            create: { key, module, description: `Permission: ${key}` },
        });
    }
    const allPermissions = await prisma.permission.findMany();
    for (const roleData of ROLES) {
        const role = await prisma.role.upsert({
            where: { name: roleData.name },
            update: { displayName: roleData.displayName, description: roleData.description },
            create: { ...roleData, isSystem: true },
        });
        const perms = shared_1.ROLE_PERMISSIONS[roleData.name] || [];
        for (const permKey of perms) {
            const permission = allPermissions.find((p) => p.key === permKey);
            if (permission) {
                await prisma.rolePermission.upsert({
                    where: {
                        roleId_permissionId: { roleId: role.id, permissionId: permission.id },
                    },
                    update: {},
                    create: { roleId: role.id, permissionId: permission.id },
                });
            }
        }
    }
    const defaultLeaveTypes = [
        { code: 'ANNUAL', name: 'Annual Leave', daysPerYear: 18 },
        { code: 'SICK', name: 'Sick Leave', daysPerYear: 10 },
        { code: 'CASUAL', name: 'Casual Leave', daysPerYear: 5 },
    ];
    const company = await prisma.company.upsert({
        where: { slug: 'acme-corp' },
        update: {},
        create: {
            name: 'Acme Corporation',
            slug: 'acme-corp',
            industry: 'Technology',
            settings: { create: {} },
            subscription: {
                create: {
                    plan: 'PROFESSIONAL',
                    status: 'ACTIVE',
                    maxUsers: 100,
                    maxProjects: 50,
                },
            },
        },
    });
    for (const lt of defaultLeaveTypes) {
        await prisma.leaveType.upsert({
            where: { companyId_code: { companyId: company.id, code: lt.code } },
            update: {},
            create: { ...lt, companyId: company.id },
        });
    }
    const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    const passwordHash = await bcryptjs_1.default.hash('Password@123', 12);
    const demoUsers = [
        {
            email: 'thcoders@admin.com',
            firstName: 'Tanya',
            lastName: '',
            roleId: superAdminRole.id,
            code: 'EMP-0001',
        }
    ];
    for (const u of demoUsers) {
        const existing = await prisma.user.findUnique({ where: { email: u.email } });
        if (existing)
            continue;
        const user = await prisma.user.create({
            data: {
                email: u.email,
                passwordHash,
                firstName: u.firstName,
                lastName: u.lastName,
                companyId: company.id,
                roleId: u.roleId,
                status: 'ACTIVE',
                emailVerified: true,
                emailVerifiedAt: new Date(),
            },
        });
        await prisma.employee.create({
            data: {
                userId: user.id,
                companyId: company.id,
                employeeCode: u.code,
                joiningDate: new Date('2024-01-15'),
            },
        });
    }
    console.log('Seed completed.');
    console.log('Demo accounts (password: Password@123):');
    demoUsers.forEach((u) => console.log(`  ${u.email}`));
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map
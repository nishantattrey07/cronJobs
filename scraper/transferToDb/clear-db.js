#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function clearDatabase() {
    const prisma = new PrismaClient();

    try {
        console.log('🗑️ Clearing database...');

        // Delete in reverse order of dependencies
        console.log('  - Clearing relationship tables...');
        await prisma.$executeRaw`DELETE FROM "SalaryRange"`;
        await prisma.$executeRaw`DELETE FROM "JobOffice"`;
        await prisma.$executeRaw`DELETE FROM "CompanyInvestor"`;
        await prisma.$executeRaw`DELETE FROM "CompanyOffice"`;
        await prisma.$executeRaw`DELETE FROM "CompanyStage"`;
        await prisma.$executeRaw`DELETE FROM "CompanyMarket"`;

        console.log('  - Clearing main entity tables...');
        await prisma.$executeRaw`DELETE FROM "Job"`;
        await prisma.$executeRaw`DELETE FROM "Company"`;

        console.log('  - Clearing reference tables...');
        await prisma.$executeRaw`DELETE FROM "Investor"`;
        await prisma.$executeRaw`DELETE FROM "Office"`;
        await prisma.$executeRaw`DELETE FROM "Stage"`;
        await prisma.$executeRaw`DELETE FROM "Market"`;

        console.log('✅ Database cleared successfully');
    } catch (error) {
        console.error('❌ Error clearing database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

clearDatabase();
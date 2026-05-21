import { PrismaClient } from '@prisma/client';
import { authenticator } from 'otplib';

const prisma = new PrismaClient();
const secret = authenticator.generateSecret(20);
await prisma.admin.updateMany({ where: {}, data: { totpSecret: secret } });
console.log('✅ Secret:', secret);
await prisma.$disconnect();
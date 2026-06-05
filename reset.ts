import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.admin.updateMany({
    data: {
      totpSecret: null,
    },
  })
  console.log('✅ Reset 2FA រួចរាល់!')
}

main().finally(() => prisma.$disconnect())
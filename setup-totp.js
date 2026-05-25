const speakeasy = require('speakeasy')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const secret = speakeasy.generateSecret({ name: 'JasminTopup Admin' })

  await prisma.admin.updateMany({
    data: {
      totpSecret: secret.base32,
    },
  })

  console.log('✅ Secret បានកំណត់រួចរាល់!')
  console.log('🔑 Secret Key:', secret.base32)
}

main().finally(() => prisma.$disconnect())
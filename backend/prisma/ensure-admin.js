require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios para iniciar el servicio');
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD debe contener al menos 12 caracteres');
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.log(`ℹ️ Usuario administrador disponible: ${email}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: 'Administrador',
      role: 'admin',
    },
  });

  console.log(`✅ Usuario administrador creado: ${email}`);
}

main()
  .catch(error => {
    console.error('❌ No fue posible preparar el administrador:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

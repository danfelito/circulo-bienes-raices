require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@circulo.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  
  if (!existingUser) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'Administrador',
        role: 'admin',
      },
    });
    console.log(`✅ Admin user created: ${adminEmail}`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
  }

  // Create sample properties
  const properties = [
    {
      title: 'Casa de Lujo en Costa de Oro',
      slug: 'casa-lujo-costa-de-oro',
      description: 'Espectacular casa de lujo frente al mar en la exclusiva zona de Costa de Oro, Veracruz. Con acabados de primera calidad, alberca privada y amplios espacios para disfrutar en familia. Cocina integral, sala de cine y terraza con vista al océano.',
      operation: 'venta',
      type: 'casa',
      price: 8500000,
      currency: 'MXN',
      bedrooms: 4,
      bathrooms: 5,
      area: 380,
      lotArea: 500,
      parking: 3,
      yearBuilt: 2022,
      city: 'Veracruz',
      state: 'Veracruz',
      address: 'Costa de Oro, Veracruz',
      lat: 19.1738,
      lng: -96.1342,
      features: JSON.stringify(['Alberca', 'Cocina integral', 'Sala de cine', 'Vista al mar', 'Terraza', 'Seguridad 24/7', 'Aire acondicionado', 'Cisterna']),
      status: 'available',
      featured: true,
    },
    {
      title: 'Departamento Moderno en Boca del Río',
      slug: 'depto-moderno-boca-del-rio',
      description: 'Departamento moderno en el corazón de Boca del Río, a pasos del centro comercial y la zona restaurantera. Dos recámaras con clóset, cocina integral, sala-comedor amplio y balcón con vista a la ciudad.',
      operation: 'venta',
      type: 'departamento',
      price: 3200000,
      currency: 'MXN',
      bedrooms: 2,
      bathrooms: 2,
      area: 110,
      lotArea: null,
      parking: 1,
      yearBuilt: 2023,
      city: 'Boca del Río',
      state: 'Veracruz',
      address: 'Boca del Río, Veracruz',
      lat: 19.1617,
      lng: -96.1061,
      features: JSON.stringify(['Cocina integral', 'Balcón', 'Gimnasio', 'Alberca comunitaria', 'Seguridad', 'Estacionamiento']),
      status: 'available',
      featured: true,
    },
    {
      title: 'Terreno Comercial en Plaza Las Americas',
      slug: 'terreno-comercial-plaza-americas',
      description: 'Excelente terreno comercial en una de las zonas de mayor crecimiento en Veracruz. Ideal para desarrollo inmobiliario, plaza comercial o mixto. Ubicación privilegiada con alto flujo vehicular.',
      operation: 'venta',
      type: 'terreno',
      price: 5500000,
      currency: 'MXN',
      bedrooms: null,
      bathrooms: null,
      area: null,
      lotArea: 1200,
      parking: null,
      yearBuilt: null,
      city: 'Veracruz',
      state: 'Veracruz',
      address: 'Plaza Las Américas, Veracruz',
      lat: 19.1630,
      lng: -96.1175,
      features: JSON.stringify(['Alto flujo vehicular', 'Escrituras al corriente', 'Servicios disponibles', 'Zona comercial']),
      status: 'available',
      featured: false,
    },
    {
      title: 'Oficina Ejecutiva Centro Histórico',
      slug: 'oficina-ejecutiva-centro-historico',
      description: 'Oficina ejecutiva en el centro histórico de Veracruz, ideal para despachos profesionales. Remodelada recientemente con acabados modernos, recepción, sala de juntas y estacionamiento.',
      operation: 'renta',
      type: 'oficina',
      price: 25000,
      currency: 'MXN',
      bedrooms: null,
      bathrooms: 2,
      area: 85,
      lotArea: null,
      parking: 2,
      yearBuilt: 2019,
      city: 'Veracruz',
      state: 'Veracruz',
      address: 'Centro Histórico, Veracruz',
      lat: 19.1427,
      lng: -96.1314,
      features: JSON.stringify(['Recepción', 'Sala de juntas', 'Estacionamiento', 'Aire acondicionado', 'Seguridad']),
      status: 'available',
      featured: false,
    },
    {
      title: 'Local Comercial en Zona Dorada',
      slug: 'local-comercial-zona-dorada',
      description: 'Local comercial en la zona dorada de Veracruz, alta afluencia turística y residentes. Ideal para restaurante, boutique o servicios. Cuenta con estacionamiento propio y fachada amplia.',
      operation: 'renta',
      type: 'local',
      price: 35000,
      currency: 'MXN',
      bedrooms: null,
      bathrooms: 2,
      area: 150,
      lotArea: null,
      parking: 4,
      yearBuilt: 2020,
      city: 'Veracruz',
      state: 'Veracruz',
      address: 'Zona Dorada, Veracruz',
      lat: 19.1703,
      lng: -96.1287,
      features: JSON.stringify(['Fachada amplia', 'Estacionamiento', 'Alta afluencia', 'Aire acondicionado']),
      status: 'available',
      featured: true,
    },
    {
      title: 'Casa Familiar en Las Ánimas',
      slug: 'casa-familiar-las-animas',
      description: 'Hermosa casa familiar en fraccionamiento privado con vigilancia. Tres recámaras, jardín amplio, cocina equipada y cuarto de servicio. Ideal para familia que busca tranquilidad y seguridad.',
      operation: 'venta',
      type: 'casa',
      price: 4500000,
      currency: 'MXN',
      bedrooms: 3,
      bathrooms: 3,
      area: 220,
      lotArea: 300,
      parking: 2,
      yearBuilt: 2021,
      city: 'Veracruz',
      state: 'Veracruz',
      address: 'Las Ánimas, Veracruz',
      lat: 19.1523,
      lng: -96.1452,
      features: JSON.stringify(['Jardín', 'Cuarto de servicio', 'Vigilancia 24/7', 'Cisterna', 'Alberca', 'Cocina equipada']),
      status: 'available',
      featured: false,
    },
  ];

  for (const prop of properties) {
    const existing = await prisma.property.findUnique({ where: { slug: prop.slug } });
    if (!existing) {
      await prisma.property.create({ data: prop });
      console.log(`✅ Property created: ${prop.title}`);
    } else {
      console.log(`ℹ️  Property already exists: ${prop.title}`);
    }
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Create default admin user
  const adminPassword = await hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      email: "admin@partsync.local",
      passwordHash: adminPassword,
      name: "시스템 관리자",
      role: "ADMIN",
      department: "IT",
      theme: "glassmorphism",
      isActive: true,
    },
  });
  console.log("Created admin user:", admin.username);

  // Create additional test users
  const managerPassword = await hash("manager123", 12);
  const manager = await prisma.user.upsert({
    where: { username: "manager" },
    update: {},
    create: {
      username: "manager",
      email: "manager@partsync.local",
      passwordHash: managerPassword,
      name: "구매 담당자",
      role: "MANAGER",
      department: "구매팀",
      theme: "glassmorphism",
      isActive: true,
    },
  });
  console.log("Created manager user:", manager.username);

  const operatorPassword = await hash("operator123", 12);
  const operator = await prisma.user.upsert({
    where: { username: "operator" },
    update: {},
    create: {
      username: "operator",
      email: "operator@partsync.local",
      passwordHash: operatorPassword,
      name: "창고 담당자",
      role: "OPERATOR",
      department: "창고팀",
      theme: "glassmorphism",
      isActive: true,
    },
  });
  console.log("Created operator user:", operator.username);

  // Create default permissions
  const roles = ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"];
  const resources = [
    "dashboard",
    "parts",
    "products",
    "suppliers",
    "sales_orders",
    "orders",
    "inventory",
    "transactions",
    "mrp",
    "audit",
    "reports",
    "users",
    "system",
  ];
  const actions = ["view", "create", "edit", "delete", "approve", "export"];

  const permissionData: { role: string; resource: string; action: string }[] = [];

  // ADMIN has all permissions
  for (const resource of resources) {
    for (const action of actions) {
      permissionData.push({ role: "ADMIN", resource, action });
    }
  }

  // MANAGER has most permissions except system and user management
  for (const resource of resources.filter((r) => r !== "system" && r !== "users")) {
    for (const action of actions) {
      permissionData.push({ role: "MANAGER", resource, action });
    }
  }
  permissionData.push({ role: "MANAGER", resource: "users", action: "view" });

  // OPERATOR has create/edit for operations
  const operatorResources = ["dashboard", "parts", "inventory", "transactions", "orders", "sales_orders", "audit"];
  for (const resource of operatorResources) {
    permissionData.push({ role: "OPERATOR", resource, action: "view" });
    if (resource !== "dashboard") {
      permissionData.push({ role: "OPERATOR", resource, action: "create" });
      permissionData.push({ role: "OPERATOR", resource, action: "edit" });
    }
  }
  for (const resource of ["products", "suppliers", "mrp", "reports"]) {
    permissionData.push({ role: "OPERATOR", resource, action: "view" });
  }

  // VIEWER has view-only access
  for (const resource of resources.filter((r) => r !== "system" && r !== "users")) {
    permissionData.push({ role: "VIEWER", resource, action: "view" });
  }

  // Insert permissions
  for (const perm of permissionData) {
    await prisma.permission.upsert({
      where: {
        role_resource_action: {
          role: perm.role,
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: {},
      create: perm,
    });
  }
  console.log(`Created ${permissionData.length} permissions`);

  // Categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { code: "ELEC" },
      update: {},
      create: { code: "ELEC", name: "전자파츠", description: "전자/전기 파츠" },
    }),
    prisma.category.upsert({
      where: { code: "MECH" },
      update: {},
      create: { code: "MECH", name: "기계파츠", description: "기계/금속 파츠" },
    }),
    prisma.category.upsert({
      where: { code: "CONS" },
      update: {},
      create: { code: "CONS", name: "소모품", description: "소모성 자재" },
    }),
  ]);
  console.log("Created categories:", categories.length);

  // Suppliers
  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { code: "SUP001" },
      update: {},
      create: {
        code: "SUP001",
        name: "삼성전자파츠",
        contactPerson: "김영호",
        phone: "02-1234-5678",
        email: "contact@samsung-parts.co.kr",
        address: "서울시 강남구",
        leadTimeDays: 5,
        paymentTerms: "월말결제",
        isActive: true,
      },
    }),
    prisma.supplier.upsert({
      where: { code: "SUP002" },
      update: {},
      create: {
        code: "SUP002",
        name: "현대정밀",
        contactPerson: "박철수",
        phone: "031-987-6543",
        email: "sales@hyundai-precision.co.kr",
        address: "경기도 화성시",
        leadTimeDays: 7,
        paymentTerms: "선결제",
        isActive: true,
      },
    }),
    prisma.supplier.upsert({
      where: { code: "SUP003" },
      update: {},
      create: {
        code: "SUP003",
        name: "대한산업자재",
        contactPerson: "이민수",
        phone: "051-456-7890",
        email: "info@daehan-mat.co.kr",
        address: "부산시 사상구",
        leadTimeDays: 10,
        paymentTerms: "월말결제",
        isActive: true,
      },
    }),
  ]);
  console.log("Created suppliers:", suppliers.length);

  // Parts
  const parts = await Promise.all([
    prisma.part.upsert({
      where: { partCode: "P-ELEC-001" },
      update: {},
      create: {
        partCode: "P-ELEC-001",
        partName: "마이크로컨트롤러 MCU-32",
        description: "32비트 ARM 마이크로컨트롤러",
        categoryId: categories[0].id,
        supplierId: suppliers[0].id,
        unit: "EA",
        unitPrice: 5500,
        safetyStock: 100,
        reorderPoint: 150,
        minOrderQty: 50,
        leadTimeDays: 5,
        storageLocation: "A-01-01",
        isActive: true,
      },
    }),
    prisma.part.upsert({
      where: { partCode: "P-ELEC-002" },
      update: {},
      create: {
        partCode: "P-ELEC-002",
        partName: "MLCC 커패시터 10uF",
        description: "세라믹 커패시터 10uF/16V",
        categoryId: categories[0].id,
        supplierId: suppliers[0].id,
        unit: "EA",
        unitPrice: 50,
        safetyStock: 1000,
        reorderPoint: 1500,
        minOrderQty: 500,
        leadTimeDays: 3,
        storageLocation: "A-01-02",
        isActive: true,
      },
    }),
    prisma.part.upsert({
      where: { partCode: "P-MECH-001" },
      update: {},
      create: {
        partCode: "P-MECH-001",
        partName: "스테인레스 볼트 M8x20",
        description: "SUS304 육각볼트 M8x20mm",
        categoryId: categories[1].id,
        supplierId: suppliers[1].id,
        unit: "EA",
        unitPrice: 150,
        safetyStock: 500,
        reorderPoint: 750,
        minOrderQty: 100,
        leadTimeDays: 7,
        storageLocation: "B-02-01",
        isActive: true,
      },
    }),
    prisma.part.upsert({
      where: { partCode: "P-MECH-002" },
      update: {},
      create: {
        partCode: "P-MECH-002",
        partName: "알루미늄 프레임 AL-6061",
        description: "알루미늄 압출 프레임 40x40mm",
        categoryId: categories[1].id,
        supplierId: suppliers[1].id,
        unit: "M",
        unitPrice: 8500,
        safetyStock: 50,
        reorderPoint: 80,
        minOrderQty: 10,
        leadTimeDays: 10,
        storageLocation: "B-03-01",
        isActive: true,
      },
    }),
    prisma.part.upsert({
      where: { partCode: "P-CONS-001" },
      update: {},
      create: {
        partCode: "P-CONS-001",
        partName: "산업용 윤활유 EP-90",
        description: "고압 기어용 윤활유 20L",
        categoryId: categories[2].id,
        supplierId: suppliers[2].id,
        unit: "CAN",
        unitPrice: 45000,
        safetyStock: 10,
        reorderPoint: 15,
        minOrderQty: 5,
        leadTimeDays: 5,
        storageLocation: "C-01-01",
        isActive: true,
      },
    }),
  ]);
  console.log("Created parts:", parts.length);

  // Create inventory records for each part
  for (const part of parts) {
    await prisma.inventory.upsert({
      where: { partId: part.id },
      update: {},
      create: {
        partId: part.id,
        currentQty: Math.floor(Math.random() * 500) + 100,
        reservedQty: 0,
        incomingQty: 0,
      },
    });
  }
  console.log("Created inventory records");

  // Products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { productCode: "PRD-001" },
      update: {},
      create: {
        productCode: "PRD-001",
        productName: "스마트 컨트롤러 유닛",
        description: "산업용 IoT 컨트롤러",
        category: "완제품",
        unit: "SET",
        isActive: true,
      },
    }),
    prisma.product.upsert({
      where: { productCode: "PRD-002" },
      update: {},
      create: {
        productCode: "PRD-002",
        productName: "자동화 모듈 A타입",
        description: "생산라인 자동화 모듈",
        category: "완제품",
        unit: "SET",
        isActive: true,
      },
    }),
  ]);
  console.log("Created products:", products.length);

  // BOM Items
  await prisma.bomItem.upsert({
    where: { productId_partId: { productId: products[0].id, partId: parts[0].id } },
    update: {},
    create: {
      productId: products[0].id,
      partId: parts[0].id,
      quantityPerUnit: 1,
      lossRate: 1.02,
      isActive: true,
    },
  });
  await prisma.bomItem.upsert({
    where: { productId_partId: { productId: products[0].id, partId: parts[1].id } },
    update: {},
    create: {
      productId: products[0].id,
      partId: parts[1].id,
      quantityPerUnit: 10,
      lossRate: 1.05,
      isActive: true,
    },
  });
  console.log("Created BOM items");

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

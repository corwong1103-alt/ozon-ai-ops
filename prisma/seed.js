const { PrismaClient } = require("@prisma/client");
const { createCipheriv, createHash, randomBytes, scryptSync } = require("crypto");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function encryptSecret(value) {
  const key = createHash("sha256").update(process.env.OZON_API_KEY_ENCRYPTION_SECRET || "dev-only-ozon-api-key-secret").digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      passwordHash: hashPassword("demo123456"),
      role: "admin",
      status: "approved",
      plan: "vip",
      credits: {
        create: {
          imageCredits: 9999,
          videoCredits: 9999,
          monthlyResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        }
      }
    }
  });

  const operator = await prisma.user.upsert({
    where: { email: "operator@demo.com" },
    update: {
      status: "approved",
      plan: "pro"
    },
    create: {
      email: "operator@demo.com",
      passwordHash: hashPassword("demo123456"),
      role: "user",
      status: "approved",
      plan: "pro",
      expiresAt: new Date("2026-12-31"),
      credits: {
        create: {
          imageCredits: 1000,
          videoCredits: 100,
          monthlyResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        }
      },
      stores: {
        create: {
          name: "Ozon Growth Store",
          ozonStoreId: "OZON-CB-90321",
          ozonClientId: "123456",
          apiKeyEncrypted: encryptSecret("ozon_live_key_masked_demo")
        }
      }
    }
  });

  const pendingUser = await prisma.user.upsert({
    where: { email: "pending@demo.com" },
    update: { status: "pending" },
    create: {
      email: "pending@demo.com",
      passwordHash: hashPassword("demo123456"),
      role: "user",
      status: "pending",
      plan: "starter",
      credits: {
        create: {
          imageCredits: 200,
          videoCredits: 20,
          monthlyResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        }
      }
    }
  });

  const store = await prisma.store.upsert({
    where: { id: "seed_store_growth" },
    update: {
      userId: operator.id,
      name: "Ozon Growth Store",
      ozonStoreId: "OZON-CB-90321",
      ozonClientId: "123456",
      apiKeyEncrypted: encryptSecret("ozon_live_key_masked_demo")
    },
    create: {
      id: "seed_store_growth",
      userId: operator.id,
      name: "Ozon Growth Store",
      ozonStoreId: "OZON-CB-90321",
      ozonClientId: "123456",
      apiKeyEncrypted: encryptSecret("ozon_live_key_masked_demo")
    }
  });

  const product = await prisma.product.upsert({
    where: { id: "seed_product_bottle" },
    update: {
      userId: operator.id,
      storeId: store.id,
      title: "316 不锈钢智能温显保温杯",
      description: "带温度显示，适合通勤、户外和礼品场景。",
      price: 29.8,
      images: [],
      status: "draft"
    },
    create: {
      id: "seed_product_bottle",
      userId: operator.id,
      storeId: store.id,
      source: "manual",
      title: "316 不锈钢智能温显保温杯",
      description: "带温度显示，适合通勤、户外和礼品场景。",
      price: 29.8,
      images: [],
      status: "draft"
    }
  });

  for (const platform of ["vk", "wibus"]) {
    await prisma.socialAccount.upsert({
      where: { userId_platform: { userId: operator.id, platform } },
      update: {
        status: "connected",
        accountName: `@ozon_${platform}_demo`
      },
      create: {
        userId: operator.id,
        platform,
        status: "connected",
        accountName: `@ozon_${platform}_demo`
      }
    });
  }

  await prisma.customerMessage.upsert({
    where: { id: "seed_customer_message_anna" },
    update: {
      userId: operator.id,
      storeId: store.id,
      customerName: "Anna K.",
      message: "这个保温杯适合送礼吗？是否有礼盒？",
      category: "presale",
      suggestedReply: "您好，这款保温杯适合作为礼物，可搭配礼盒包装。",
      status: "suggested"
    },
    create: {
      id: "seed_customer_message_anna",
      userId: operator.id,
      storeId: store.id,
      customerName: "Anna K.",
      message: "这个保温杯适合送礼吗？是否有礼盒？",
      category: "presale",
      suggestedReply: "您好，这款保温杯适合作为礼物，可搭配礼盒包装。",
      status: "suggested"
    }
  });

  await prisma.taskLog.createMany({
    data: [
      {
        id: "seed_task_translate",
        userId: operator.id,
        productId: product.id,
        type: "translate",
        status: "success",
        creditCost: 0,
        message: "mock：基础翻译完成，不扣额度。"
      },
      {
        id: "seed_task_image",
        userId: operator.id,
        productId: product.id,
        type: "image",
        status: "success",
        creditCost: 1,
        message: "mock：AI商品图生成完成，扣 imageCredits。"
      }
    ],
    skipDuplicates: true
  });

  console.log(`Seed complete. Admin: ${admin.email} / demo123456. Pending: ${pendingUser.email} / demo123456.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

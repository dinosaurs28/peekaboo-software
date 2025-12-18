const admin = require("firebase-admin");
const path = require("path");

// 🔑 Load service account key
const serviceAccount = require(path.join(
  __dirname,
  "serviceAccountKey.json"
));

// 🚀 Initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateCustomers() {
  console.log("Connected to project:", admin.app().options.projectId);

  const snap = await db.collection("Customers").get();

  console.log("Customers found:", snap.size);

  if (snap.empty) {
    console.log("No customers found in collection.");
    return;
  }

  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    if (typeof data.gstin === "string") continue;

    await doc.ref.update({
      gstin: "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    updated++;
  }

  console.log(`Migration complete. Updated ${updated} customers.`);
}

migrateCustomers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });

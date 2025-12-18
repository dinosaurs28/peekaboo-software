const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, updateDoc, doc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateCustomers() {
  const snap = await getDocs(collection(db, "customers"));
  let updated = 0;

  for (const d of snap.docs) {
    const data = d.data();

    if (typeof data.gstin === "string") continue;

    await updateDoc(doc(db, "customers", d.id), {
      gstin: "",
      updatedAt: new Date().toISOString(),
    });

    updated++;
  }

  console.log(`Migration complete. Updated ${updated} customers.`);
}

migrateCustomers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });


  // run : node scripts/migrate-customers-gstin.js
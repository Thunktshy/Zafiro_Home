// hash-passwords.js
const bcrypt = require('bcrypt');


// Example passwords to hash
const passwords = [
  "Ricardoydiego.1",
  "Tulipanenses123",
  "Agato25"
];

// Number of salt rounds (higher = more secure but slower)
const saltRounds = 10;


// Stored hash from your database


const storedHash = "$2b$10$G0VynUS9FF4cn2.gK2/tF.VAL.zCJlBIzySVKSA3V5UmAg8X6SFqi";

// Plaintext password to check
const enteredPassword = "Ricardoydiego.1";

(async () => {
  console.log("=== Hashing Passwords ===");
  for (const pwd of passwords) {
    try {
      const hash = await bcrypt.hash(pwd, saltRounds);
      console.log(`Password: ${pwd}`);
      console.log(`Hash: ${hash}\n`);
    } catch (err) {
      console.error(`Error hashing password "${pwd}":`, err);
    }
  }


  console.log("=== Checking Password ===");
  try {
    const match = await bcrypt.compare(enteredPassword, storedHash);
    console.log(match ? "✅ Password is correct!" : "❌ Password is incorrect.");
  } catch (err) {
    console.error("Error comparing password:", err);
  }
})();


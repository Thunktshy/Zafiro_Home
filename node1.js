// hash-passwords.js
const bcrypt = require('bcrypt');

// Example passwords
const passwords = [
  "Ricardoydiego.1",
  "Tulipanenses123",
  "Agato25"
];

// Number of salt rounds (higher = more secure but slower)
const saltRounds = 10;

(async () => {
  for (const pwd of passwords) {
    try {
      const hash = await bcrypt.hash(pwd, saltRounds);
      console.log(`Password: ${pwd}`);
      console.log(`Hash: ${hash}\n`);
    } catch (err) {
      console.error(`Error hashing password "${pwd}":`, err);
    }
  }
})();

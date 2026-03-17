// const mysql = require("mysql2");

/*const db = mysql.createConnection({
  host: "77.37.48.35",
  user: "u498357097_invoicemaker",
  password: "ayVILQzR05O^",
  database: "u498357097_invoicemaker",
  port: 43001
});*/

// railway
/*const db = mysql.createConnection({
  host: "junction.proxy.rlwy.net",
  user: "root",
  password: "JjWgQBZSRgswbflieUJQLpsYtiCCtsyk",
  database: "railway",
  port: 43001
});*/
// hostinger
/*const db = mysql.createConnection({
  host: "srv1098.hstgr.io",
  user: "u498357097_invoicemaker",
  password: "ayVILQzR05O^",
  database: "u498357097_invoicemaker",
  port: 3306
});


db.connect((err) => {
  if (err) {
    console.log("Database connection failed", err);
  } else {
    console.log("MySQL Connected");
  }
});

module.exports = db;*/

const mysql = require("mysql2");

// ✅ Create Pool (auto reconnect handle karega)
const db = mysql.createPool({
  host: "srv1098.hstgr.io",
  user: "u498357097_invoicemaker",
  password: "ayVILQzR05O^",
  database: "u498357097_invoicemaker",
  port: 3306,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  connectTimeout: 20000
});

// ✅ Test connection (startup pe)
db.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection failed ❌", err);
  } else {
    console.log("MySQL Connected ✅");
    connection.release();
  }
});

// ✅ Runtime error handle (VERY IMPORTANT)
db.on("error", (err) => {
  console.error("MySQL runtime error:", err);

  if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNRESET") {
    console.log("Reconnecting to database...");
  } else {
    throw err;
  }
});

module.exports = db;
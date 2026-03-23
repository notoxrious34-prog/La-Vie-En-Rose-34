const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

exports.activateLicense = functions.https.onRequest(async (req, res) => {
  try {
    const {licenseKey, machineId} = req.body;

    if (!licenseKey || !machineId) {
      return res.status(400).json({
        success: false,
        message: "Missing licenseKey or machineId",
      });
    }

    const licenseRef = db.collection("licenses").doc(licenseKey);
    const doc = await licenseRef.get();

    if (!doc.exists) {
      return res.json({
        success: false,
        message: "Invalid License",
      });
    }

    const data = doc.data();

    if (data.revoked === true) {
      return res.json({
        success: false,
        message: "License Revoked",
      });
    }

    if (!data.machineId) {
      await licenseRef.update({
        machineId,
        activatedAt: new Date(),
      });

      return res.json({
        success: true,
        message: "License Activated",
      });
    }

    if (data.machineId !== machineId) {
      return res.json({
        success: false,
        message: "License already used on another machine",
      });
    }

    return res.json({
      success: true,
      message: "License Valid",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

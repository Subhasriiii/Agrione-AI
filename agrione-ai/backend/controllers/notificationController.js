const Notification = require('../models/Notification');

// Get user notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort('-createdAt').limit(30);
    const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

// Mark as read
exports.markRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true });
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
};

// Mark all as read
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
};

// Generate alerts (called internally or via API)
exports.generateAlerts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { farmData, weatherData } = req.body;
    const alerts = [];

    if (farmData) {
      if (farmData.soilData?.moisture < 30) {
        alerts.push({ user: userId, type: 'irrigation', title: 'Low Soil Moisture', message: `Soil moisture is ${farmData.soilData.moisture}%. Consider irrigating soon.`, severity: 'warning' });
      }
      if (farmData.soilData?.pH < 5.5 || farmData.soilData?.pH > 8.0) {
        alerts.push({ user: userId, type: 'soil', title: 'Soil pH Alert', message: `Soil pH is ${farmData.soilData.pH}. This is outside the optimal range (6.0-7.5).`, severity: 'warning' });
      }
    }

    if (weatherData) {
      if (weatherData.temperature > 40) {
        alerts.push({ user: userId, type: 'weather', title: 'Heat Wave Warning', message: 'Temperature exceeds 40°C. Ensure adequate irrigation and crop protection.', severity: 'critical' });
      }
      if (weatherData.rainfall > 100) {
        alerts.push({ user: userId, type: 'weather', title: 'Heavy Rainfall Alert', message: 'Heavy rainfall expected. Check field drainage.', severity: 'warning' });
      }
    }

    if (alerts.length > 0) {
      await Notification.insertMany(alerts);
    }

    res.json({ success: true, alertsGenerated: alerts.length, alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate alerts.' });
  }
};

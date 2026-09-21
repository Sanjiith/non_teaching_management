const Notification = require('../models/Notification.model');
const User = require('../models/User.model');

/**
 * Creates a notification for a user
 * @param {object} params
 * @param {string} params.user - Target user ID
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification body
 * @param {string} [params.type='info'] - 'info', 'success', 'warning', 'error'
 * @param {string} [params.link=''] - Optional URL to redirect to on click
 */
exports.createNotification = async ({ user, title, message, type = 'info', link = '' }) => {
  try {
    const notification = new Notification({
      user,
      title,
      message,
      type,
      link,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    // Fail silently so it doesn't break main workflows (like leave apply)
    return null;
  }
};

/**
 * Creates a notification for an entire department (specifically for HODs)
 */
exports.notifyHOD = async ({ departmentId, title, message, type = 'info', link = '' }) => {
  try {
    // Find HOD of this department
    const hod = await User.findOne({ department: departmentId, role: 'HOD', isActive: true });
    if (hod) {
      return this.createNotification({ user: hod._id, title, message, type, link });
    }
  } catch (error) {
    console.error('Error notifying HOD:', error);
  }
};

/**
 * Creates a notification for all Admins
 */
exports.notifyAdmins = async ({ title, message, type = 'info', link = '' }) => {
  try {
    const admins = await User.find({ role: 'Admin', isActive: true });
    const promises = admins.map(admin => 
      this.createNotification({ user: admin._id, title, message, type, link })
    );
    await Promise.all(promises);
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
};

const Notification = require('../models/Notification.model');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * @desc    Get current user's notifications
 * @route   GET /api/notifications
 * @access  Private
 */
const getMyNotifications = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Notification.countDocuments({ user: req.user._id });
    const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });

    return sendSuccess(res, 200, 'Notifications fetched successfully', {
      notifications,
      total,
      unreadCount,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (error) {
    console.error('Get Notifications Error:', error);
    return sendError(res, 500, 'Server error while fetching notifications');
  }
};

/**
 * @desc    Mark a notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return sendError(res, 404, 'Notification not found');
    }

    return sendSuccess(res, 200, 'Notification marked as read', { notification });
  } catch (error) {
    console.error('Mark Notification Read Error:', error);
    return sendError(res, 500, 'Server error while updating notification');
  }
};

/**
 * @desc    Mark all user's notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true }
    );

    return sendSuccess(res, 200, 'All notifications marked as read', {});
  } catch (error) {
    console.error('Mark All Notifications Read Error:', error);
    return sendError(res, 500, 'Server error while updating notifications');
  }
};

/**
 * @desc    Get unread notification count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
    return sendSuccess(res, 200, 'Unread count fetched', { count });
  } catch (error) {
    console.error('Get Unread Count Error:', error);
    return sendError(res, 500, 'Server error while fetching unread count');
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount
};

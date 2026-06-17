const JournalEntry = require('../models/JournalEntry');
const logger = require('../config/logger');

const createEntry = async (req, res, next) => {
  try {
    const entry = await JournalEntry.create(req.user.userId, req.body);
    logger.info('Journal entry created', { userId: req.user.userId, entryId: entry.entry_id });
    res.status(201).json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
};

const listEntries = async (req, res, next) => {
  try {
    const limit  = req.query.limit  ? parseInt(req.query.limit, 10)  : 30;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const entries = await JournalEntry.getUserEntries(req.user.userId, { limit, offset });
    res.json({ success: true, data: { entries, count: entries.length } });
  } catch (error) {
    next(error);
  }
};

const deleteEntry = async (req, res, next) => {
  try {
    const ok = await JournalEntry.deleteOne(req.params.entryId, req.user.userId);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { createEntry, listEntries, deleteEntry };

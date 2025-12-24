const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth.middleware');
const requireRole = require('../../middlewares/role.middleware');
const audit = require('../../middlewares/audit.middleware');
const controller = require('./page.controller');

router.get('/', controller.list);
router.get('/:id', controller.get);
// Create & update pages: admin or superadmin
router.post('/', auth, requireRole('admin'), audit({ resourceType: 'page' }), controller.create);
router.put('/:id', auth, requireRole('admin'), audit({ resourceType: 'page' }), controller.update);
// Publish/unpublish/schedule/rollback
router.post('/:id/publish', auth, requireRole('admin'), audit({ resourceType: 'page' }), controller.publish);
router.post('/:id/unpublish', auth, requireRole('admin'), audit({ resourceType: 'page' }), controller.unpublish);
router.post('/:id/schedule', auth, requireRole('admin'), audit({ resourceType: 'page' }), controller.schedule);
router.post('/:id/rollback', auth, requireRole('admin'), audit({ resourceType: 'page' }), controller.rollback);

// Delete pages: only superadmin
router.delete('/:id', auth, requireRole('superadmin'), audit({ resourceType: 'page' }), controller.remove);

module.exports = router;

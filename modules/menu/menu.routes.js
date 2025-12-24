const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth.middleware');
const requireRole = require('../../middlewares/role.middleware');
const audit = require('../../middlewares/audit.middleware');
const controller = require('./menu.controller');

router.get('/', controller.list);
router.get('/type/:type', controller.listByType);
router.post('/', auth, requireRole('admin'), audit({ resourceType: 'menu' }), controller.create);
router.get('/:id', controller.getById);
router.put('/:id', auth, requireRole('admin'), audit({ resourceType: 'menu' }), controller.update);
router.delete('/:id', auth, requireRole('superadmin'), audit({ resourceType: 'menu' }), controller.remove);

module.exports = router;

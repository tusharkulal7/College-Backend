const Joi = require('joi');
const { email, password, name, userRoles, departmentId, active } = require('../../validations');

const createSchema = Joi.object({
  email: email.required(),
  password: password.required(),
  firstName: name.required(),
  lastName: name.required(),
  roles: userRoles.optional(),
  departmentId: departmentId,
  isActive: active
});

const updateSchema = Joi.object({
  email: email.optional(),
  password: password.optional(),
  firstName: name.optional(),
  lastName: name.optional(),
  roles: userRoles.optional(),
  departmentId: departmentId,
  isActive: active
});

module.exports = { createSchema, updateSchema };
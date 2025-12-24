const Joi = require('joi');

const LocalizedString = Joi.object({ en: Joi.string().required(), kn: Joi.string().allow('', null) });

const menuItem = Joi.object({
  title: LocalizedString.required(),
  url: Joi.string().uri().optional(),
  order: Joi.number().optional(),
  target: Joi.string().valid('_self', '_blank').optional(),
});

const createSchema = Joi.object({
  name: LocalizedString.required(),
  slug: Joi.string().required(),
  type: Joi.string().valid('header', 'footer', 'navigation').optional(),
  items: Joi.array().items(menuItem).optional(),
  active: Joi.boolean().optional(),
  order: Joi.number().optional(),
  departmentId: Joi.string().optional(),
});

const updateSchema = Joi.object({
  name: LocalizedString.optional(),
  slug: Joi.string().optional(),
  type: Joi.string().valid('header', 'footer', 'navigation').optional(),
  items: Joi.array().items(menuItem).optional(),
  active: Joi.boolean().optional(),
  order: Joi.number().optional(),
  departmentId: Joi.string().optional(),
});

module.exports = { createSchema, updateSchema };

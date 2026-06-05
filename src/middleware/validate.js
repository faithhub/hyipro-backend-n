const Joi = require('joi');

const passwordSchema = Joi.string().min(8).max(128).required();
const emailSchema = Joi.string().email({ tlds: { allow: false } }).required();

const schemas = {
  register: Joi.object({
    email: emailSchema,
    password: passwordSchema,
    first_name: Joi.string().max(100).optional().allow('', null),
    last_name: Joi.string().max(100).optional().allow('', null),
    country: Joi.string().max(100).optional().allow('', null),
    referral_code: Joi.string().max(64).optional().allow('', null),
  }),

  login: Joi.object({
    email: emailSchema,
    password: Joi.string().max(128).required(),
  }),

  requestPasswordReset: Joi.object({
    email: emailSchema,
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: passwordSchema,
  }),
};

const validate = (schemaName) => (req, res, next) => {
  const schema = schemas[schemaName];
  if (!schema) return next();
  const { error } = schema.validate(req.body, { abortEarly: false, allowUnknown: false });
  if (error) {
    const messages = error.details.map((d) => d.message.replace(/"/g, "'"));
    return res.status(400).json({ error: messages.join('; ') });
  }
  next();
};

module.exports = { validate };

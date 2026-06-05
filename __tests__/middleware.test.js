const jwt = require('jsonwebtoken');
const { authMiddleware, adminMiddleware } = require('../src/middleware/auth');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('authMiddleware', () => {
    it('should pass with valid token', () => {
      const token = jwt.sign({ id: 1, role: 'user' }, 'test-secret', { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;

      process.env.JWT_SECRET = 'test-secret';

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toHaveProperty('id', 1);
    });

    it('should fail with no token', () => {
      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should fail with invalid token', () => {
      req.headers.authorization = 'Bearer invalid-token';
      process.env.JWT_SECRET = 'test-secret';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should fail with suspended account', () => {
      const token = jwt.sign({ id: 1, role: 'user', status: 'suspended' }, 'test-secret', { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;
      process.env.JWT_SECRET = 'test-secret';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Account is suspended' });
    });
  });

  describe('adminMiddleware', () => {
    it('should pass with admin role', () => {
      const token = jwt.sign({ id: 1, role: 'admin' }, 'test-secret', { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;
      process.env.JWT_SECRET = 'test-secret';

      adminMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should fail with non-admin role', () => {
      const token = jwt.sign({ id: 1, role: 'user' }, 'test-secret', { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;
      process.env.JWT_SECRET = 'test-secret';

      adminMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});

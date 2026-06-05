const { validateEnv } = require('../src/utils/envValidator');

describe('Environment Validator', () => {
  let originalEnv;
  let originalExit;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalExit = process.exit;
    process.exit = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    process.exit = originalExit;
  });

  it('should validate all required environment variables', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_USER = 'root';
    process.env.DB_PASSWORD = 'password';
    process.env.DB_NAME = 'test_db';
    process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough';

    validateEnv();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('should call process.exit if DB_HOST is missing', () => {
    delete process.env.DB_HOST;
    process.env.DB_USER = 'root';
    process.env.DB_PASSWORD = 'password';
    process.env.DB_NAME = 'test_db';
    process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough';

    validateEnv();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should warn but not exit if JWT_SECRET is too short', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_USER = 'root';
    process.env.DB_PASSWORD = 'password';
    process.env.DB_NAME = 'test_db';
    process.env.JWT_SECRET = 'short';

    validateEnv();
    expect(process.exit).not.toHaveBeenCalled(); // JWT_SECRET length is just a warning
  });

  it('should not exit if DB_PASSWORD is missing (optional)', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_USER = 'root';
    delete process.env.DB_PASSWORD;
    process.env.DB_NAME = 'test_db';
    process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough';

    validateEnv();
    expect(process.exit).not.toHaveBeenCalled(); // DB_PASSWORD is optional
  });
});

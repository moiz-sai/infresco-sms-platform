import { validateEnv } from './env';

describe('validateEnv', () => {
  const valid = {
    DATABASE_URL: 'postgres://sms_app@localhost:5432/sms_dev',
    SESSION_SECRET: 'x'.repeat(32),
  };

  it('applies defaults for a valid env', () => {
    expect(validateEnv(valid)).toMatchObject({
      PORT: 8080,
      DEVICE_PREFIX: 'D1',
    });
  });

  it('stops boot with a clear message when DATABASE_URL is missing', () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ SESSION_SECRET: valid.SESSION_SECRET })).toThrow(
      'exit',
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls[0][0]).toContain('DATABASE_URL');
    exit.mockRestore();
    error.mockRestore();
  });
});

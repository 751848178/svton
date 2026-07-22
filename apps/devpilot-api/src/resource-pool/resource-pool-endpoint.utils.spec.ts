import { parseResourceEndpoint } from './resource-pool-endpoint.utils';

describe('parseResourceEndpoint', () => {
  it('parses host:port without a scheme using the default port', () => {
    expect(parseResourceEndpoint('mysql.internal:3306', 3306)).toEqual({
      host: 'mysql.internal',
      port: 3306,
    });
  });

  it('parses a tcp:// scheme and keeps the explicit port', () => {
    expect(parseResourceEndpoint('tcp://redis.internal:6380', 6379)).toEqual({
      host: 'redis.internal',
      port: 6380,
    });
  });

  it('parses a mysql:// scheme and falls back to the default port when missing', () => {
    expect(parseResourceEndpoint('mysql://db.internal', 3306)).toEqual({
      host: 'db.internal',
      port: 3306,
    });
  });

  it('falls back to default port when no port is present', () => {
    expect(parseResourceEndpoint('redis.internal', 6379)).toEqual({
      host: 'redis.internal',
      port: 6379,
    });
  });
});

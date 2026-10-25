import {describe, expect, it} from 'vitest';
import {AppSession, isSecureRequest} from './session';

describe('isSecureRequest', () => {
  it.each([
    ['https://shop.example/', true],
    ['https://shop.example:8443/cart?x=1', true],
    ['http://shop.example/', false],
    ['http://localhost:3000/', false],
  ])('%s -> %s', (url, expected) => {
    expect(isSecureRequest(new Request(url))).toBe(expected);
  });
});

describe('AppSession cookie', () => {
  async function sessionCookie(url: string) {
    const session = await AppSession.init(new Request(url), ['test-secret']);
    session.set('customer', 'c1');
    return session.commit();
  }

  it('is HttpOnly and SameSite=Lax', async () => {
    const cookie = await sessionCookie('http://localhost:3000/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('is Secure over https', async () => {
    expect(await sessionCookie('https://shop.example/')).toContain('Secure');
  });

  it('is not Secure over plain http, so local development keeps working', async () => {
    expect(await sessionCookie('http://localhost:3000/')).not.toContain(
      'Secure',
    );
  });

  it('reads a cookie it issued over https back', async () => {
    const issued = await sessionCookie('https://shop.example/');
    const next = await AppSession.init(
      new Request('https://shop.example/', {
        headers: {Cookie: issued.split(';')[0]},
      }),
      ['test-secret'],
    );
    expect(next.get('customer')).toBe('c1');
  });
});

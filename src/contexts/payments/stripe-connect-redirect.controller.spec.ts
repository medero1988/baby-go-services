import {
  StripeConnectRedirectController,
  toAppDeepLink,
} from './stripe-connect-redirect.controller';

describe('toAppDeepLink', () => {
  it('accepts app schemes', () => {
    expect(toAppDeepLink('bbgo://stripe-connect/return')).toBe(
      'bbgo://stripe-connect/return',
    );
    expect(
      toAppDeepLink('exp://192.168.1.10:8081/--/stripe-connect/return'),
    ).toBe('exp://192.168.1.10:8081/--/stripe-connect/return');
  });

  it('rejects web and script schemes', () => {
    for (const url of [
      'https://evil.example',
      'http://evil.example',
      'javascript://%0Aalert(1)',
      'JavaScript://x',
      'data://text/html,x',
      'not a url',
      '',
      undefined,
    ]) {
      expect(toAppDeepLink(url)).toBeUndefined();
    }
  });
});

describe('StripeConnectRedirectController', () => {
  const controller = new StripeConnectRedirectController();

  it('redirects to the app deep link', () => {
    const html = controller.onboardingReturn('bbgo://stripe-connect/return');
    expect(html).toContain(
      'window.location.replace("bbgo://stripe-connect/return")',
    );
    expect(html).toContain('href="bbgo://stripe-connect/return"');
  });

  it('cannot break out of the script tag', () => {
    const html = controller.onboardingRefresh(
      'bbgo://x</script><script>alert(1)',
    );
    expect(html).not.toContain('</script><script>alert(1)');
  });

  it('renders without redirect when none is valid', () => {
    const html = controller.onboardingReturn('https://evil.example');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('evil.example');
  });
});

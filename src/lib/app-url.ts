function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getAppBaseUrl(request?: Request | URL | string): string {
  const configured =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;

  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (request) {
    const url =
      typeof request === "string"
        ? new URL(request)
        : request instanceof URL
          ? request
          : new URL(request.url);
    return trimTrailingSlash(url.origin);
  }

  return "http://localhost:3000";
}

export function absoluteAppUrl(
  pathname: string,
  request?: Request | URL | string
): string {
  return new URL(pathname, `${getAppBaseUrl(request)}/`).toString();
}

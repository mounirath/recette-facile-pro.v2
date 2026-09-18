// @ts-nocheck
const makeProxy = () => new Proxy(() => {}, {
  get: () => makeProxy()
});

export const api: any = makeProxy();
export const internal: any = makeProxy();

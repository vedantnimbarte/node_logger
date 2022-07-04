/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import split from 'split2';

export function sink() {
  const result = split((data: string) => {
    try {
      return JSON.parse(data);
    } catch (err) {
      console.log(err);
      console.log(data);
      return {};
    }
  });

  return result;
}

export function once(emitter: any, name: string): any {
  return new Promise((resolve, reject) => {
    if (name !== 'error') emitter.once('error', reject);
    emitter.once(name, (...args: any) => {
      emitter.removeListener('error', reject);
      resolve(...args);
    });
  });
}

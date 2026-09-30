export class ServiceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

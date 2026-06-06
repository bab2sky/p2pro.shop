const API_URL = process.env.E2E_API_URL || 'http://localhost:8080';

export class ApiHelper {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_URL;
  }

  async signup(data: {
    username: string;
    email: string;
    password: string;
    real_name: string;
  }) {
    const resp = await fetch(`${this.baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return resp.json();
  }

  async login(email: string, password: string) {
    const resp = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return resp.json();
  }

  async authenticatedRequest(
    path: string,
    token: string,
    options: RequestInit = {},
  ) {
    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  }
}

/**
 * Validation utilities for data integrity and type safety
 * Provides schema validation, sanitization, and type guards
 */

import { z } from 'zod';

// Common validation schemas
export const schemas = {
  // User validation
  user: z.object({
    id: z.string().uuid(),
    username: z.string().min(1).max(255).trim(),
    role: z.enum(['admin', 'manager', 'employee']),
    active: z.boolean().optional(),
    email: z.string().email().optional(),
    displayName: z.string().max(255).optional(),
  }),

  // Customer validation
  customer: z.object({
    id: z.string().uuid().optional(),
    fullName: z.string().min(1).max(255).trim(),
    phone: z.string().regex(/^[+]?[\d\s\-()]+$/).optional(),
    email: z.string().email().optional(),
    address: z.string().max(500).optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
  }),

  // Product validation
  product: z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(255).trim(),
    description: z.string().max(1000).optional(),
    price: z.number().min(0),
    cost: z.number().min(0).optional(),
    stock: z.number().int().min(0).optional(),
    category: z.string().max(100).optional(),
    sku: z.string().max(100).optional(),
    barcode: z.string().max(50).optional(),
    active: z.boolean().optional(),
  }),

  // Order validation
  order: z.object({
    id: z.string().uuid().optional(),
    customerId: z.string().uuid(),
    items: z.array(z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
      totalPrice: z.number().min(0),
    })).min(1),
    subtotal: z.number().min(0),
    tax: z.number().min(0),
    total: z.number().min(0),
    paymentMethod: z.enum(['cash', 'cib', 'edahabia', 'transfer', 'mixed']),
    status: z.enum(['pending', 'paid', 'completed', 'cancelled']).optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
  }),

  // Authentication validation
  login: z.object({
    username: z.string().min(1).max(255),
    password: z.string().min(1).max(1000),
  }),

  // Settings validation
  settings: z.object({
    storeName: z.string().min(1).max(255).optional(),
    storeAddress: z.string().max(500).optional(),
    storePhone: z.string().regex(/^[+]?[\d\s\-()]+$/).optional(),
    storeEmail: z.string().email().optional(),
    currency: z.string().length(3).optional(),
    taxRate: z.number().min(0).max(1).optional(),
    logoUrl: z.string().url().optional(),
  }),
};

// Validation helper class
export class Validator {
  static validate<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: true;
    data: T;
  } | {
    success: false;
    errors: string[];
  } {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return { success: true, data: result.data };
    }
    
    const errors = result.error.issues.map(issue => 
      `${issue.path.join('.')}: ${issue.message}`
    );
    
    return { success: false, errors };
  }

  static validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
    const result = this.validate(schema, data);
    
    if (!result.success) {
      throw new Error(`Validation failed: ${result.errors.join(', ')}`);
    }
    
    return result.data;
  }

  // Sanitize string inputs
  static sanitizeString(input: unknown, maxLength = 1000): string {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .slice(0, maxLength);
  }

  // Sanitize numbers
  static sanitizeNumber(input: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
    const num = Number(input);
    
    if (isNaN(num) || !isFinite(num)) return min;
    
    return Math.max(min, Math.min(max, num));
  }

  // Validate UUID format
  static isValidUUID(input: unknown): boolean {
    if (typeof input !== 'string') return false;
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(input);
  }

  // Validate phone number (basic international format)
  static isValidPhone(input: unknown): boolean {
    if (typeof input !== 'string') return false;
    
    const phoneRegex = /^[+]?[\d\s\-()]{10,20}$/;
    return phoneRegex.test(input.trim());
  }

  // Validate email format
  static isValidEmail(input: unknown): boolean {
    if (typeof input !== 'string') return false;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input.trim());
  }
}

// Type guards
export const typeGuards = {
  isString: (value: unknown): value is string => typeof value === 'string',
  
  isNumber: (value: unknown): value is number => 
    typeof value === 'number' && !isNaN(value) && isFinite(value),
  
  isBoolean: (value: unknown): value is boolean => typeof value === 'boolean',
  
  isObject: (value: unknown): value is Record<string, unknown> => 
    typeof value === 'object' && value !== null && !Array.isArray(value),
  
  isArray: (value: unknown): value is unknown[] => Array.isArray(value),
  
  isDate: (value: unknown): value is Date => value instanceof Date && !isNaN(value.getTime()),
  
  isUUID: (value: unknown): value is string => 
    typeof value === 'string' && Validator.isValidUUID(value),
  
  isEmail: (value: unknown): value is string => 
    typeof value === 'string' && Validator.isValidEmail(value),
  
  isPhone: (value: unknown): value is string => 
    typeof value === 'string' && Validator.isValidPhone(value),
};

// Data transformation utilities
export const transformers = {
  // Transform API data to frontend format
  transformCustomer: (data: unknown) => {
    const validated = Validator.validateOrThrow(schemas.customer, data);
    
    return {
      ...validated,
      displayName: validated.fullName,
      searchTerms: `${validated.fullName} ${validated.phone || ''} ${validated.email || ''}`.toLowerCase(),
    };
  },

  transformProduct: (data: unknown) => {
    const validated = Validator.validateOrThrow(schemas.product, data);
    
    return {
      ...validated,
      displayName: validated.name,
      profitMargin: validated.cost ? (validated.price - validated.cost) / validated.price : 0,
      isInStock: (validated.stock ?? 0) > 0,
    };
  },

  transformOrder: (data: unknown) => {
    const validated = Validator.validateOrThrow(schemas.order, data);
    
    return {
      ...validated,
      itemCount: validated.items.length,
      totalItems: validated.items.reduce((sum, item) => sum + item.quantity, 0),
      displayStatus: validated.status || 'pending',
    };
  },
};

// Export convenience functions
export const validate = Validator.validate.bind(Validator);
export const validateOrThrow = Validator.validateOrThrow.bind(Validator);
export const sanitizeString = Validator.sanitizeString.bind(Validator);
export const sanitizeNumber = Validator.sanitizeNumber.bind(Validator);

export type UserRole = "buyer" | "seller" | "admin";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type ProductStatus = "active" | "out_of_stock" | "hidden";
export type ProductCondition = "new" | "used_like_new" | "used_good" | "used_fair";

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  new: "Brand new",
  used_like_new: "Used, like new",
  used_good: "Used, good condition",
  used_fair: "Used, fair condition",
};

export const GAMBIA_CITIES = [
  "Banjul",
  "Serrekunda",
  "Kanifing",
  "Brikama",
  "Bakau",
  "Farafenni",
  "Basse Santa Su",
  "Sukuta",
  "Gunjur",
  "Soma",
] as const;
export type OrderStatus =
  | "placed"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled";
export type PaymentMethod = "digital" | "cod";
export type PaymentMethodType = "bank" | "mobile_money";

export interface SellerPaymentMethod {
  id: string;
  seller_id: string;
  method_type: PaymentMethodType;
  provider_name: string;
  account_name: string;
  account_number: string;
  is_active: boolean;
  created_at: string;
}
export type PaymentStatus = "pending" | "paid" | "failed";

export interface AppUser {
  id: string;
  phone_number: string;
  full_name: string;
  role: UserRole;
  city: string | null;
  profile_photo_url: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface Seller {
  id: string;
  business_name: string;
  id_document_url: string | null;
  verification_status: VerificationStatus;
  wave_number: string | null;
  shop_description: string | null;
  shop_banner_url: string | null;
  rating_avg: number;
  total_sales: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  parent_category_id: string | null;
}

export interface Product {
  id: string;
  seller_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  status: ProductStatus;
  condition: ProductCondition;
  location_city: string;
  created_at: string;
}

export interface ProductPhoto {
  id: string;
  product_id: string;
  photo_url: string;
  sort_order: number;
  is_cover: boolean;
}

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  delivery_city: string | null;
  delivery_notes: string | null;
  created_at: string;
}

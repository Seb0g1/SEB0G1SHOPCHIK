export type ClientVariant = {
  id: string;
  productId: string;
  color: string;
  size: string;
  sku: string;
  price: number;
  stockQty: number;
  avitoExternalId: string | null;
  publicationStatus: string;
  sortOrder: number;
};

export type ClientPhoto = {
  id: string;
  productId: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  color: string | null;
  sortOrder: number;
  publicUrl: string;
  createdAt: string;
};

export type ClientPublicationRun = {
  id: string;
  productId: string | null;
  feedVersion: string;
  status: string;
  submittedAt: string;
  reportStatus: string | null;
  errors: string[];
  warnings: string[];
  rawReport: string | null;
};

export type ClientProduct = {
  id: string;
  title: string;
  brand: string | null;
  category: string;
  goodsType: string;
  productType: string;
  adType: string;
  gender: string;
  condition: string;
  basePrice: number;
  description: string;
  generatedDescription: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  variants: ClientVariant[];
  photos: ClientPhoto[];
  publicationRuns: ClientPublicationRun[];
};

export type ClientAvitoSettings = {
  clientId: string;
  hasClientSecret: boolean;
  sellerLocation: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  publicFeedUrl: string;
  redirectUrl: string;
};

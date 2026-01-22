import { create } from 'zustand'

// This store will be used to manage products loaded from Discord commands
export const useProductsStore = create((set, get) => ({
  products: [],
  loading: false,
  error: null,

  // Set products
  setProducts: (products) => set({ products }),

  // Add a product
  addProduct: (product) => set((state) => ({
    products: [...state.products, product]
  })),

  // Update a product
  updateProduct: (productId, updates) => set((state) => ({
    products: state.products.map(p =>
      p.id === productId ? { ...p, ...updates } : p
    )
  })),

  // Remove a product
  removeProduct: (productId) => set((state) => ({
    products: state.products.filter(p => p.id !== productId)
  })),

  // Add an EXE to a product
  addExeToProduct: (productId, exe) => set((state) => ({
    products: state.products.map(p =>
      p.id === productId
        ? { ...p, exes: [...(p.exes || []), exe] }
        : p
    )
  })),

  // Remove an EXE from a product
  removeExeFromProduct: (productId, exeId) => set((state) => ({
    products: state.products.map(p =>
      p.id === productId
        ? { ...p, exes: (p.exes || []).filter(e => e.id !== exeId) }
        : p
    )
  })),

  // Get product by ID
  getProduct: (productId) => get().products.find(p => p.id === productId),

  // Load products from storage
  loadProducts: async () => {
    set({ loading: true })
    try {
      if (window.api) {
        const storedProducts = await window.api.storeGet('products')
        if (storedProducts) {
          set({ products: storedProducts, loading: false })
        }
      }
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  // Save products to storage
  saveProducts: async () => {
    try {
      if (window.api) {
        await window.api.storeSet('products', get().products)
      }
    } catch (error) {
      set({ error: error.message })
    }
  }
}))

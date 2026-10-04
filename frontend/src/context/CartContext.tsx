import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import toast from "../components/toast/toast";
import type { CartItem, Product } from "../types";
import { MAX_PER_PRODUCT } from "../utils/orderLimits";

interface CartContextType{
    items:CartItem[],
    addToCart : (product:Product, quantity?: number) => void;
    removeFromCart:(productId:string) => void;
    updateQuantity:(productId:string, quantity:number) => void;
    clearCart:() => void;
    cartCount:number;
    cartTotal:number;
    isCartOpen:boolean;
    setIsCartOpen:(open:boolean) => void
    applyQuote:(lines: { product: string; price: number; originalPrice: number; stock: number }[]) => void
}


const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider ({children} : {children:ReactNode}){


    const [items,setItems] = useState<CartItem[]>(() =>{
        const saved = localStorage.getItem("app_cart");
        // Carts saved before the per-order limit existed are brought within it.
        return saved ? (JSON.parse(saved) as CartItem[]).map((item) => ({ ...item, quantity: Math.min(item.quantity, MAX_PER_PRODUCT) })) : []
    })


    const [isCartOpen, setIsCartOpen] = useState(false);

    useEffect(() =>{
        localStorage.setItem("app_cart", JSON.stringify(items))
    },[items])

    const addToCart = (product:Product, quantity = 1) =>{
        setItems((prev) =>{
            const existing = prev.find((item) => item.product._id === product._id);
            if(existing){
                return prev.map((item) => item.product._id === product._id ? {...item, quantity:Math.min(item.quantity + quantity, MAX_PER_PRODUCT)} : item)
            }
            return [...prev, {product,quantity:Math.min(quantity, MAX_PER_PRODUCT)}]
        })
        setIsCartOpen(true)
        toast.success(`${product.name} added to cart`, { duration: 2500 })
    }

    const removeFromCart = (productId:string) =>{
        setItems((prev) => prev.filter((item) => item.product._id !== productId))
    }

    const updateQuantity = (productId:string, quantity:number) =>{
        if(quantity <= 0){
            removeFromCart(productId);
            return
        }
        setItems((prev) => prev.map((item) => (item.product._id === productId ? {...item,quantity:Math.min(quantity, MAX_PER_PRODUCT)} : item)))
    }

    // Keeps the saved cart in step with the server's current prices and stock.
    const applyQuote = (lines: { product: string; price: number; originalPrice: number; stock: number }[]) => {
        setItems((prev) => {
            let changed = false;
            const next = prev.map((item) => {
                const line = lines.find((entry) => entry.product === item.product._id);
                if (!line || (line.price === item.product.price && line.originalPrice === item.product.originalPrice && line.stock === item.product.stock)) return item;
                changed = true;
                const discount = line.originalPrice > line.price ? Math.round(((line.originalPrice - line.price) / line.originalPrice) * 100) : 0;
                return { ...item, product: { ...item.product, price: line.price, originalPrice: line.originalPrice, stock: line.stock, discount } };
            });
            return changed ? next : prev;
        });
    }

    const clearCart = () =>{
        setItems([]);
        setIsCartOpen(false)
    }

    const cartCount = items.reduce((sum, item) => sum + item.quantity,0)
    const cartTotal = items.reduce((sum, item) => sum + item.product.price * item.quantity,0)


    return (
      <CartContext.Provider
        value={{
          items,
          addToCart,
          removeFromCart,
          updateQuantity,
          cartCount,
          clearCart,
          cartTotal,
          isCartOpen,
          setIsCartOpen,
          applyQuote,
        }}
      >
        {children}
      </CartContext.Provider>
    );
}

// The hook lives with its provider, like useCustomerAuth.
// eslint-disable-next-line react-refresh/only-export-components
export function useCart(){
    const context = useContext(CartContext);
    if(!context) throw new Error("useCart must be used within CartProvider")
    return context;
}
import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from './components/ui'
const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const ShopLayout = lazy(() => import('./layouts/ShopLayout'))
import Landing from './pages/landing/Landing'
const Signup = lazy(() => import('./pages/landing/Signup'))
const Login = lazy(() => import('./pages/landing/Login'))
const Console = lazy(() => import('./pages/landing/Console'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Sales = lazy(() => import('./pages/admin/Sales'))
const Orders = lazy(() => import('./pages/admin/Orders'))
const OrderDetail = lazy(() => import('./pages/admin/OrderDetail'))
const Products = lazy(() => import('./pages/admin/Products'))
const ProductEdit = lazy(() => import('./pages/admin/ProductEdit'))
const Stock = lazy(() => import('./pages/admin/Stock'))
const Lots = lazy(() => import('./pages/admin/Lots'))
const Purchases = lazy(() => import('./pages/admin/Purchases'))
const Suppliers = lazy(() => import('./pages/admin/Suppliers'))
const Customers = lazy(() => import('./pages/admin/Customers'))
const CustomerDetail = lazy(() => import('./pages/admin/CustomerDetail'))
const Loyalty = lazy(() => import('./pages/admin/Loyalty'))
const Promotions = lazy(() => import('./pages/admin/Promotions'))
const Ecommerce = lazy(() => import('./pages/admin/Ecommerce'))
const POS = lazy(() => import('./pages/admin/POS'))
const Deliveries = lazy(() => import('./pages/admin/Deliveries'))
const Marketing = lazy(() => import('./pages/admin/Marketing'))
const Analytics = lazy(() => import('./pages/admin/Analytics'))
const Employees = lazy(() => import('./pages/admin/Employees'))
const Stores = lazy(() => import('./pages/admin/Stores'))
const Finance = lazy(() => import('./pages/admin/Finance'))
const Settings = lazy(() => import('./pages/admin/Settings'))
const Messages = lazy(() => import('./pages/admin/Messages'))
const ShopHome = lazy(() => import('./pages/shop/ShopHome'))
const Catalog = lazy(() => import('./pages/shop/Catalog'))
const ProductPage = lazy(() => import('./pages/shop/ProductPage'))
const Cart = lazy(() => import('./pages/shop/Cart'))
const Checkout = lazy(() => import('./pages/shop/Checkout'))
const OrderTracking = lazy(() => import('./pages/shop/OrderTracking'))
const Routines = lazy(() => import('./pages/shop/Routines'))
const Quiz = lazy(() => import('./pages/shop/Quiz'))
const Blog = lazy(() => import('./pages/shop/Blog'))
const Article = lazy(() => import('./pages/shop/Article'))
const Wishlist = lazy(() => import('./pages/shop/Wishlist'))
const Account = lazy(() => import('./pages/shop/Account'))

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollTop />
      {/* Route chunks load in a few ms: a thin progress bar instead of a centred spinner. */}
      <Suspense fallback={<div className="fixed top-0 inset-x-0 h-0.5 z-[var(--z-toast)] overflow-hidden" aria-hidden><div className="h-full w-full skeleton !rounded-none" style={{ background: 'linear-gradient(90deg, transparent, var(--color-sage-400), transparent)', backgroundSize: '50% 100%' }} /></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/inscription" element={<Signup />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/console" element={<Console />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="ventes" element={<Sales />} />
          <Route path="commandes" element={<Orders />} />
          <Route path="commandes/:id" element={<OrderDetail />} />
          <Route path="produits" element={<Products />} />
          <Route path="produits/:id" element={<ProductEdit />} />
          <Route path="stock" element={<Stock />} />
          <Route path="lots" element={<Lots />} />
          <Route path="achats" element={<Purchases />} />
          <Route path="fournisseurs" element={<Suppliers />} />
          <Route path="clients" element={<Customers />} />
          <Route path="clients/:id" element={<CustomerDetail />} />
          <Route path="fidelite" element={<Loyalty />} />
          <Route path="promotions" element={<Promotions />} />
          <Route path="ecommerce" element={<Ecommerce />} />
          <Route path="pos" element={<POS />} />
          <Route path="livraisons" element={<Deliveries />} />
          <Route path="marketing" element={<Marketing />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="employes" element={<Employees />} />
          <Route path="boutiques" element={<Stores />} />
          <Route path="finance" element={<Finance />} />
          <Route path="parametres" element={<Settings />} />
          <Route path="messages" element={<Messages />} />
        </Route>
        <Route path="/boutique" element={<ShopLayout />}>
          <Route index element={<ShopHome />} />
          <Route path="catalogue" element={<Catalog />} />
          <Route path="produit/:id" element={<ProductPage />} />
          <Route path="panier" element={<Cart />} />
          <Route path="commande" element={<Checkout />} />
          <Route path="suivi/:id" element={<OrderTracking />} />
          <Route path="routines" element={<Routines />} />
          <Route path="quiz" element={<Quiz />} />
          <Route path="conseils" element={<Blog />} />
          <Route path="conseils/:slug" element={<Article />} />
          <Route path="favoris" element={<Wishlist />} />
          <Route path="compte" element={<Account />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <Toaster />
    </>
  )
}

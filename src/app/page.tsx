/*

"use client"

import { useAuth } from "@/lib/contexts/auth-context"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { Phone, Mail, MapPin, ShoppingCart, Star, ArrowRight, CheckCircle, Calendar, Clock } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const featuredProducts = [
  {
    id: 1,
    name: "Grundfos Submersible Pump",
    category: "Submersible Pumps",
    price: 1299,
    originalPrice: 1499,
    image: "/pumps.png",
    badge: "SALE",
    rating: 4.8,
    inStock: true,
  },
  {
    id: 2,
    name: "Davey Pressure Pump",
    category: "Pressure Pumps",
    price: 899,
    image: "/pumps.png",
    badge: "POPULAR",
    rating: 4.9,
    inStock: true,
  },
  {
    id: 3,
    name: "Xylem Grinder Pump",
    category: "Grinder Pumps",
    price: 2199,
    image: "/grinder.png",
    badge: "NEW",
    rating: 4.7,
    inStock: true,
  },
  {
    id: 4,
    name: "Flygt Vortex Pump",
    category: "Vortex Pumps",
    price: 1799,
    image: "/pumps.png",
    rating: 4.6,
    inStock: false,
  },
]

const categories = [
  {
    name: "Pressure Pumps",
    description: "High-performance pressure pumps for residential and commercial use",
    image: "/pumps.png",
    productCount: 45,
  },
  {
    name: "Submersible Pumps",
    description: "Reliable submersible pumps for wells and water systems",
    image: "/pumps.png",
    productCount: 32,
  },
  {
    name: "Grinder Pumps",
    description: "Heavy-duty grinder pumps for sewage and waste water",
    image: "/pumps.png",
    productCount: 18,
  },
  {
    name: "Sump Pumps",
    description: "Efficient sump pumps for basement and drainage applications",
    image: "/pumps.png",
    productCount: 28,
  },
  {
    name: "Pump Stations",
    description: "Complete pump station solutions for large-scale operations",
    image: "/pumps.png",
    productCount: 12,
  },
  {
    name: "Accessories",
    description: "Pump accessories, parts, and maintenance supplies",
    image: "/pumps.png",
    productCount: 156,
  },
]

const whyChooseUs = [
  "Highly Experienced Team",
  "Fast and Professional Service",
  "Large Stock Holdings",
  "Australian Owned & Operated",
  "Competitive Pricing",
  "Technical Support Available",
]

const blogPosts = [
  {
    title: "How to Choose the Right Pump for Your Application",
    excerpt: "A comprehensive guide to selecting the perfect pump for your specific needs and requirements.",
    date: "Dec 15, 2024",
    image: "/blog-pump.png",
  },
  {
    title: "Pump Maintenance Tips to Extend Equipment Life",
    excerpt: "Essential maintenance practices that will help your pumps run efficiently for years to come.",
    date: "Dec 10, 2024",
    image: "/blog-pump.png",
  },
  {
    title: "Understanding Pump Performance Curves",
    excerpt: "Learn how to read and interpret pump performance curves to optimize your system.",
    date: "Dec 5, 2024",
    image: "/blog-pump.png",
  },
]

export default function HomePage() {
  const { user, loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="w-8 h-8 border-2 border-[hsl(185,100%,45%)] border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <ScrollArea className="h-[calc(100dvh)] bg-white">
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <Image
                  src="/logo.png"
                  alt="Quality Pumps Logo"
                  width={120}
                  height={40}
                  className="h-8 w-auto"
                />
              </div>
              <nav className="hidden lg:flex space-x-8">
                <Link href="#products" className="text-slate-700 hover:text-[hsl(185,100%,45%)] transition-colors">
                  Products
                </Link>
                <Link href="#categories" className="text-slate-700 hover:text-[hsl(185,100%,45%)] transition-colors">
                  Categories
                </Link>
                <Link href="#services" className="text-slate-700 hover:text-[hsl(185,100%,45%)] transition-colors">
                  Services
                </Link>
                <Link href="#about" className="text-slate-700 hover:text-[hsl(185,100%,45%)] transition-colors">
                  About
                </Link>
                <Link href="#contact" className="text-slate-700 hover:text-[hsl(185,100%,45%)] transition-colors">
                  Contact
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-4 text-sm text-slate-600">
                <div className="flex items-center space-x-1">
                  <Phone className="w-4 h-4" />
                  <span>07 2111 8693</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Mail className="w-4 h-4" />
                  <span>info@qualitypumps.com.au</span>
                </div>
              </div>
              {user ? (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-slate-600">Welcome, {profile?.full_name || user.email}!</span>
                  <Button asChild className="bg-[hsl(185,100%,45%)] hover:bg-[hsl(185,100%,40%)]">
                    <Link href="/dashboard">My Account</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" asChild>
                    <Link href="/auth/sign-in">Sign In</Link>
                  </Button>
                  <Button asChild className="bg-[hsl(185,100%,45%)] hover:bg-[hsl(185,100%,40%)]">
                    <Link href="/auth/sign-up">Register</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      <section className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/40"></div>
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('https://images.squarespace-cdn.com/content/v1/60ded8a08559bb3a988f1ae1/26779ae5-f027-40c2-bab4-5bc0f4e288e5/1.jpg?format=1500w')",
          }}
        ></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <div className="space-y-6">
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl lg:text-6xl font-bold leading-tight"
                >
                  Australia's Easiest To Deal With Supplier Of{" "}
                  <span className="text-[hsl(185,100%,45%)]">Pressure Pumps</span>,{" "}
                  <span className="text-[hsl(185,100%,45%)]">Sump Pumps</span>,{" "}
                  <span className="text-[hsl(185,100%,45%)]">Pump Stations</span> And More!
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-xl text-slate-200 leading-relaxed"
                >
                  Quality pumps and professional service across Australia. From residential to industrial applications,
                  we have the right pump solution for your needs.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Button
                  size="lg"
                  className="bg-[hsl(185,100%,45%)] hover:bg-[hsl(185,100%,40%)] text-white px-8 py-4 text-lg"
                >
                  <ShoppingCart className="mr-2 w-5 h-5" />
                  Shop Now
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white hover:text-slate-900 px-8 py-4 text-lg bg-transparent"
                >
                  <Phone className="mr-2 w-5 h-5" />
                  Get Quote
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex items-center space-x-8 text-sm"
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-[hsl(185,100%,45%)]" />
                  <span>Free Delivery Australia Wide</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-[hsl(185,100%,45%)]" />
                  <span>Expert Technical Support</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-[hsl(185,100%,45%)]" />
                  <span>Australian Warranty</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="products" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900">Featured Products</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Discover our most popular and trusted pump solutions
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {featuredProducts.map((product, index) => (
              <motion.div key={product.id} variants={fadeInUp}>
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-md group">
                  <div className="relative">
                    <Image
                      src={product.image || "/placeholder.svg"}
                      alt={product.name}
                      width={200}
                      height={200}
                      className="w-full h-48 object-cover rounded-t-lg"
                    />
                    {product.badge && (
                      <Badge
                        className={`absolute top-3 left-3 ${product.badge === "SALE"
                            ? "bg-red-500"
                            : product.badge === "NEW"
                              ? "bg-green-500"
                              : "bg-[hsl(185,100%,45%)]"
                          }`}
                      >
                        {product.badge}
                      </Badge>
                    )}
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-lg">
                        <span className="text-white font-semibold">Out of Stock</span>
                      </div>
                    )}
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {product.category}
                      </Badge>
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm text-slate-600">{product.rating}</span>
                      </div>
                    </div>
                    <CardTitle className="text-lg group-hover:text-[hsl(185,100%,45%)] transition-colors">
                      {product.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl font-bold text-slate-900">${product.price.toLocaleString()}</span>
                        {product.originalPrice && (
                          <span className="text-sm text-slate-500 line-through">
                            ${product.originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      className="w-full bg-[hsl(185,100%,45%)] hover:bg-[hsl(185,100%,40%)]"
                      disabled={!product.inStock}
                    >
                      {product.inStock ? (
                        <>
                          <ShoppingCart className="mr-2 w-4 h-4" />
                          Add to Cart
                        </>
                      ) : (
                        "Notify When Available"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Button size="lg" variant="outline" className="px-8 bg-transparent">
              View All Products
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      <section id="categories" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900">Popular Categories</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Browse our comprehensive range of pump categories
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {categories.map((category, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-md group cursor-pointer">
                  <div className="relative overflow-hidden">
                    <Image
                      src={category.image || "/placeholder.svg"}
                      alt={category.name}
                      width={150}
                      height={150}
                      className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-4 left-4 text-white">
                      <h3 className="text-lg font-semibold">{category.name}</h3>
                      <p className="text-sm opacity-90">{category.productCount} products</p>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <p className="text-slate-600 mb-4">{category.description}</p>
                    <Button
                      variant="outline"
                      className="w-full group-hover:bg-[hsl(185,100%,45%)] group-hover:text-white group-hover:border-[hsl(185,100%,45%)] transition-colors bg-transparent"
                    >
                      Browse Category
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <h2 className="text-3xl lg:text-4xl font-bold">
                  Why Choose <span className="text-[hsl(185,100%,45%)]">Quality Pumps</span>
                </h2>
                <p className="text-xl text-slate-300">
                  We provide Australia's most comprehensive range of high-quality pumps and specialist services that are
                  manufactured, designed for optimal performance and lasting reliability.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {whyChooseUs.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center space-x-3"
                  >
                    <CheckCircle className="w-5 h-5 text-[hsl(185,100%,45%)] flex-shrink-0" />
                    <span className="text-slate-200">{item}</span>
                  </motion.div>
                ))}
              </div>

              <Button size="lg" className="bg-[hsl(185,100%,45%)] hover:bg-[hsl(185,100%,40%)] px-8">
                Learn More About Us
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative">
                <Image
                  src="/plumber.png"
                  alt="Quality Pumps Technician"
                  width={400}
                  height={500}
                  className="rounded-2xl shadow-2xl"
                />
                <motion.div
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                  className="absolute -top-6 -right-6 bg-[hsl(185,100%,45%)] text-white p-4 rounded-xl shadow-lg"
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold">25+</div>
                    <div className="text-sm">Years Experience</div>
                  </div>
                </motion.div>
                <motion.div
                  animate={{
                    y: [0, 10, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                    delay: 1,
                  }}
                  className="absolute -bottom-6 -left-6 bg-white text-slate-900 p-4 rounded-xl shadow-lg"
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[hsl(185,100%,45%)]">10k+</div>
                    <div className="text-sm">Happy Customers</div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900">News | Blog - Latest Posts</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Stay up to date with pump news, maintenance tips, and industry insights
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-8"
          >
            {blogPosts.map((post, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-md group">
                  <div className="relative overflow-hidden">
                    <Image
                      src={post.image || "/placeholder.svg"}
                      alt={post.title}
                      width={300}
                      height={200}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="text-sm text-[hsl(185,100%,45%)] font-medium">{post.date}</div>
                      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-[hsl(185,100%,45%)] transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-slate-600 text-sm">{post.excerpt}</p>
                      <Button
                        variant="ghost"
                        className="p-0 h-auto text-[hsl(185,100%,45%)] hover:text-[hsl(185,100%,35%)]"
                      >
                        Read More
                        <ArrowRight className="ml-1 w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-[hsl(185,100%,45%)] to-[hsl(185,100%,35%)] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h2 className="text-3xl lg:text-4xl font-bold">Need to Schedule Your First Service?</h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Contact us today to speak with one of our pump specialists. We're here to help you find the perfect
              solution for your needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="secondary"
                className="bg-white text-[hsl(185,100%,45%)] hover:bg-slate-100 px-8"
              >
                <Calendar className="mr-2 w-5 h-5" />
                Schedule Service
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-[hsl(185,100%,45%)] px-8 bg-transparent"
              >
                <Phone className="mr-2 w-5 h-5" />
                Call Now: 07 2111 8693
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <Image
                src="/logo.png"
                alt="Quality Pumps Logo"
                width={120}
                height={40}
                className="h-8 w-auto"
              />
              <p className="text-slate-400 text-sm">
                Australia's most trusted supplier of quality pumps and professional pump services. Serving residential,
                commercial, and industrial customers nationwide.
              </p>
              <div className="flex items-center space-x-2 text-sm text-slate-400">
                <MapPin className="w-4 h-4" />
                <span>Proudly Australian Owned & Operated</span>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Our Services
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Installation
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Maintenance
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Warranty
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Product Categories</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Pressure Pumps
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Submersible Pumps
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Grinder Pumps
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Sump Pumps
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Pump Stations
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Contact Information</h3>
              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-center space-x-2">
                  <Phone className="w-4 h-4" />
                  <span>07 2111 8693</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>info@qualitypumps.com.au</span>
                </li>
                <li className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>Sydney, Melbourne, Brisbane</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Mon-Fri: 7AM-6PM AEST</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} Quality Pumps Australia. All rights reserved.</p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <span className="text-sm text-slate-400">We accept:</span>
              <div className="flex space-x-2">
                <div className="w-8 h-5 bg-slate-700 rounded flex items-center justify-center">
                  <span className="text-xs text-white">VISA</span>
                </div>
                <div className="w-8 h-5 bg-slate-700 rounded flex items-center justify-center">
                  <span className="text-xs text-white">MC</span>
                </div>
                <div className="w-8 h-5 bg-slate-700 rounded flex items-center justify-center">
                  <span className="text-xs text-white">AMEX</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </ScrollArea>
  )
}

*/

'use client';

import { useAuth } from '@/lib/contexts/auth-context';
import Link from 'next/link';

export default function HomePage() {
  const { user, loading, profile } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <main>
      <h1>Welcome to Quality Pumps!</h1>
      {user ? (
        <div>
          <p>Hello, {profile?.full_name || user.email}!</p>
          <Link href='/dashboard'>Go to Dashboard</Link>
        </div>
      ) : (
        <div>
          <p>
            Please <Link href='/auth/sign-in'>sign in</Link> to access your
            dashboard.
          </p>
        </div>
      )}
    </main>
  );
}

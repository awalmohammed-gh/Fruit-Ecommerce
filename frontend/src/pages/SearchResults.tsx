import type { Product } from "../types";
import { Link, useSearchParams } from "react-router-dom";
import { productsApi } from "../frontApisRoute/products";
import { useResource } from "../hooks/useResource";
import { Home, Search, PackageIcon, ArrowRight, XCircle } from "lucide-react";
import Loading from "../components/card/Loading";
import ProductCard from "../components/card/ProductCard";

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") || "").trim();
  // Searches names and descriptions on the server; up to 48 matches.
  const results = useResource(`search:${query}`, () => (query ? productsApi.list({ q: query, limit: 48, sort: "rating" }) : Promise.resolve(null)));
  const product: Product[] = results.data?.products ?? [];
  const loading = Boolean(query) && results.loading && !results.data;

  return (
    <div className="bg-app-cream pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-app-text-light mb-8">
          <Link
            to={"/"}
            className="hover:text-app-green transition-colors duration-300 flex items-center gap-1"
          >
            <Home className="size-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <span className="text-app-text-light">/</span>
          <Link
            to={"/products"}
            className="hover:text-app-green transition-colors duration-300"
          >
            Products
          </Link>
          <span className="text-app-text-light">/</span>
          <span className="text-app-green font-semibold truncate max-w-[150px] sm:max-w-none">
            Search Results
          </span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-app-green/10 rounded-xl">
              <Search className="size-6 text-app-green" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                Results for "{query}"
              </h1>
              <p className="text-sm text-app-text-light mt-0.5">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-pulse">Searching...</span>
                  </span>
                ) : (
                  <span>
                    <span className="font-semibold text-app-green">
                      {product.length}
                    </span>{" "}
                    item{product.length === 1 ? "" : "s"} found
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Search summary */}
          {!loading && product.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-app-text-light ml-14">
              <span className="flex items-center gap-1">
                <PackageIcon className="size-3" />
                {product.filter((p) => p.stock > 0).length} in stock
              </span>
              <span className="w-px h-3 bg-app-border"></span>
              <span>
                {product.filter((p) => p.discount > 0).length} on sale
              </span>
            </div>
          )}
        </div>

        {/* Results */}
        {results.error ? (
          <div role="alert" className="text-center py-16 bg-white rounded-2xl border border-app-border/50">
            <p className="text-lg font-semibold text-gray-800 mb-2">We couldn't search right now</p>
            <p className="text-sm text-app-text-light mb-4">{results.error}</p>
            <button type="button" onClick={results.reload} className="px-5 py-2.5 bg-app-green text-white text-sm font-medium rounded-xl">Try again</button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Loading />
          </div>
        ) : product.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-app-border/50">
            <div className="max-w-sm mx-auto px-4">
              <div className="w-24 h-24 bg-app-cream rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="size-10 text-app-text-light" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                No Results Found
              </h2>
              <p className="text-sm text-app-text-light mb-6">
                We couldn't find any products matching "{query}". Try adjusting
                your search terms or browse our categories.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to={"/products"}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-app-green text-white font-medium rounded-xl hover:bg-green-800 transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  Browse All Products
                  <ArrowRight className="size-4" />
                </Link>
                <button
                  onClick={() => window.history.back()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-gray-700 font-medium rounded-xl border border-app-border hover:bg-app-cream transition-all duration-300"
                >
                  Go Back
                </button>
              </div>

              {/* Search suggestions */}
              <div className="mt-6">
                <p className="text-xs text-app-text-light mb-2">
                  Try searching for:
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {["organic", "fresh", "vegetables", "fruits", "grains"].map(
                    (term) => (
                      <Link
                        key={term}
                        to={`/search?q=${term}`}
                        className="px-3 py-1.5 text-xs bg-app-cream text-app-text-light rounded-full hover:bg-app-green hover:text-white transition-all duration-300"
                      >
                        {term}
                      </Link>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Results count bar */}
            <div className="flex items-center justify-between mb-4 text-sm">
              <span className="text-app-text-light">
                Showing{" "}
                <span className="font-semibold text-gray-700">
                  {product.length}
                </span>{" "}
                results
              </span>
              <span className="text-xs text-app-text-light">
                Sorted by relevance
              </span>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 gap-y-8">
              {product.map((item) => (
                <ProductCard product={item} key={item._id} />
              ))}
            </div>
          </>
        )}

        {/* Quick search tip */}
        {!loading && product.length > 0 && (
          <div className="mt-12 text-center">
            <p className="text-xs flex items-center text-app-text-light gap-2">
              <Search className="size-4"/> Can't find what you're looking for? Try refining your search
              term
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;

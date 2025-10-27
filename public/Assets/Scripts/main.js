function getCookieValue(cookieName) {
    const cookies = document.cookie.split('; ');
    for (let cookie of cookies) {
        const [name, value] = cookie.split('=');
        if (name === cookieName) {
            return decodeURIComponent(value);
        }
    }
    return null; // Return null if the cookie is not found
}

function loadpage(url){
    window.location.href = url;
}

function formatDate(date) {
    return new Date(date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });
}

function reloadPage() {
    window.location.reload();
}

function scrollToHash() {
    const headerHeight = document.querySelector('header').offsetHeight;
    const url = new URL(window.location.href);
    const targetId = url.hash.substring(1);
    if (targetId) {
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            const targetPosition = targetElement.offsetTop - headerHeight - 100; // Adjust 90px as needed
            window.scrollTo({top: targetPosition, behavior: 'smooth'});
        }
    }
}

// Cart utility functions
window.cartUtils = {
    getCart: function() {
        const cartData = localStorage.getItem('cart');
        return cartData ? JSON.parse(cartData) : [];
    },

    saveCart: function(cart) {
        localStorage.setItem('cart', JSON.stringify(cart));
    },

    addToCart: function(product) {
        const cart = this.getCart();
        const existingItemIndex = cart.findIndex(item => 
            item.id === product.id && 
            item.size === product.size && 
            item.color === product.color
        );

        if (existingItemIndex > -1) {
            cart[existingItemIndex].quantity += product.quantity || 1;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
                size: product.size || null,
                color: product.color || null,
                quantity: product.quantity || 1
            });
        }

        this.saveCart(cart);
        return cart;
    },

    removeFromCart: function(productId, size = null, color = null) {
        let cart = this.getCart();
        cart = cart.filter(item => !(
            item.id === productId && 
            item.size === size && 
            item.color === color
        ));
        this.saveCart(cart);
        return cart;
    },

    updateQuantity: function(productId, newQuantity, size = null, color = null) {
        const cart = this.getCart();
        const itemIndex = cart.findIndex(item => 
            item.id === productId && 
            item.size === size && 
            item.color === color
        );

        if (itemIndex > -1) {
            if (newQuantity <= 0) {
                cart.splice(itemIndex, 1);
            } else {
                cart[itemIndex].quantity = newQuantity;
            }
        }

        this.saveCart(cart);
        return cart;
    },

    getCartCount: function() {
        const cart = this.getCart();
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    },

    getCartTotal: function() {
        const cart = this.getCart();
        return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    },

    clearCart: function() {
        localStorage.removeItem('cart');
        return [];
    }
};
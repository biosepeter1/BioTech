
    document.addEventListener("DOMContentLoaded", function () {
        const success = <%- JSON.stringify(success || []) %>;
        console.log('Success messages:', success);
        if (success && Array.isArray(success) && success.length > 0) {
            Swal.fire({
                toast: true,
                position: 'top',
                text: success[0],
                icon: 'success',
                background: '#1e3a8a',
                color: '#fff',
                showConfirmButton: false,
                timer: 3500,
                timerProgressBar: true,
                customClass: { popup: 'rounded-xl shadow-md border border-indigo-400' }
            });
        } else {
            console.log('No success message to display');
        }
    });
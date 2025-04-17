document.addEventListener('DOMContentLoaded', () => {
    const loadingDiv = document.getElementById('loading');
  
    // Show loading icon during page transitions
    window.addEventListener('beforeunload', () => {
      loadingDiv.classList.remove('hidden');
    });
  
    // Hide loading icon when page is fully loaded
    window.addEventListener('load', () => {
      loadingDiv.classList.add('hidden');
    });
  
    // Handle form submissions with AJAX
    const forms = document.querySelectorAll('form[data-ajax]');
    forms.forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        loadingDiv.classList.remove('hidden');
  
        const formData = new FormData(form);
        const action = form.action;
        const method = form.method.toUpperCase();
  
        try {
          const response = await fetch(action, {
            method,
            body: formData,
          });
          const data = await response.json();
  
          loadingDiv.classList.add('hidden');
  
          if (data.success) {
            // Assuming SweetAlert2 is included for consistency with your setup
            Swal.fire({
              toast: true,
              position: 'top',
              icon: 'success',
              title: data.message,
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
              animation: true,
              showClass: { popup: 'animate__animated animate__slideInDown' },
              hideClass: { popup: 'animate__animated animate__slideOutUp' },
            }).then(() => {
              if (data.message.includes('Redirecting')) {
                window.location.href = form.dataset.redirect || '/';
              }
            });
          } else {
            Swal.fire({
              toast: true,
              position: 'top',
              icon: 'error',
              title: data.message,
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
            });
          }
        } catch (error) {
          loadingDiv.classList.add('hidden');
          Swal.fire({
            toast: true,
            position: 'top',
            icon: 'error',
            title: 'An error occurred. Please try again.',
            showConfirmButton: false,
            timer: 3000,
          });
        }
      });
    });
  });
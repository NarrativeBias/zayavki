document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded and parsed');
    const form = document.querySelector('form');
    if (form) {
        console.log('Form found');
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            console.log('Form submit event triggered');
            logFormData(this);
            submitForm(this);
        });
    } else {
        console.error('Form not found in the document');
    }
});

function submitForm(form) {
    console.log('Submitting form...');
    const formData = new FormData(form);
    
    fetch('/zayavki/submit', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text();
    })
    .then(data => {
        console.log('Form submission successful, data:', data);
        const resultElement = document.getElementById('result');
        if (resultElement) {
            resultElement.textContent = data;
        } else {
            console.warn('Result element not found');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while submitting the form. Please try again.');
    });
}
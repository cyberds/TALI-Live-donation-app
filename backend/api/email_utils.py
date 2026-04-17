from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings

def send_tali_email(subject, template_name, context, recipient_list):
    """
    Sends a professional TALI branded email with both HTML and plain-text versions.
    """
    # Ensure brand URLs are available in context
    base_url = "https://tali-live-donation-4kj5z0sjn-doosu-beres-projects.vercel.app"
    
    if 'logo_url' not in context:
        context['logo_url'] = f"{base_url}/favicon.png"
    
    if 'hero_url' not in context:
        context['hero_url'] = f"{base_url}/gala-hero.jpg"
    
    if 'bg_url' not in context:
        context['bg_url'] = f"{base_url}/TALI%20ART%20WHITE%20BG.png"
    
    # Render the HTML content
    html_content = render_to_string(template_name, context)
    
    # Create the plain text version
    text_content = strip_tags(html_content)
    
    # Create the email
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@theabilitylife.org')
    email = EmailMultiAlternatives(subject, text_content, from_email, recipient_list)
    email.attach_alternative(html_content, "text/html")
    
    # Send it
    try:
        email.send(fail_silently=False)
        return True
    except Exception as e:
        print(f"Error sending TALI email: {e}")
        return False

def send_donation_receipt(donation):
    """
    Utility to send a donation receipt to the donor if they provided an email.
    """
    if not donation.email:
        return False
        
    subject = "Thank You for Your Donation - TALI"
    template_name = "api/emails/donation_receipt.html"
    
    context = {
        'donor_name': donation.donor_name if not donation.is_anonymous else "Valued Supporter",
        'amount': f"{donation.amount:,.2f}",
        'reference': donation.transaction_reference,
        'date': donation.created_at.strftime('%B %d, %Y'),
        'payment_method': donation.get_payment_mode_display(),
    }
    
    return send_tali_email(subject, template_name, context, [donation.email])

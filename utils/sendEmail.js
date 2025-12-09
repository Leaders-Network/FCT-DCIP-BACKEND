/**
 * Legacy email utility - now uses UnifiedEmailService
 * Kept for backward compatibility
 */
const UnifiedEmailService = require('../services/UnifiedEmailService');

module.exports = async (email, mailType, content) => {
  try {
    console.log('📧 Sending email via Unified Email Service');
    console.log('   To:', email);
    console.log('   Type:', mailType);

    let result;

    if (mailType === "verifyemail") {
      // Extract OTP from content if it's an OTP email
      const otpMatch = content.match(/\b\d{5,6}\b/);
      if (otpMatch) {
        result = await UnifiedEmailService.sendOTPEmail(email, otpMatch[0]);
      } else {
        // Generic email
        result = await UnifiedEmailService.sendEmail({
          to: email,
          subject: "Verify Your Email - FCT-DCIP",
          html: content
        });
      }
    } else if (mailType === "surveyorCredentials") {
      // For surveyor credentials, use generic send (credentials should be in content)
      result = await UnifiedEmailService.sendEmail({
        to: email,
        subject: "Your DCIP Surveyor Account Credentials",
        html: content
      });
    } else {
      // Password reset or other
      result = await UnifiedEmailService.sendEmail({
        to: email,
        subject: "Reset Your Password - FCT-DCIP",
        html: content
      });
    }

    return result;
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    throw error;
  }
};


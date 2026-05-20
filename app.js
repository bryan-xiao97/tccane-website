/* ==========================================================================
   TCCANE Interactive Features (app.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all features
  initThemeToggle();
  initMobileMenu();
  initAccordion();
  initUniformTracker();
  initChaptersFilter();
  initInquiryForm();
});

/* ==========================================================================
   1. Theme Toggle (Persistent Light/Dark Mode)
   ========================================================================== */
function initThemeToggle() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const sunIcon = themeToggleBtn.querySelector('.sun-icon');
  const moonIcon = themeToggleBtn.querySelector('.moon-icon');
  
  // Check local storage or system preference
  const savedTheme = localStorage.getItem('tccane-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    enableDarkMode();
  } else {
    enableLightMode();
  }
  
  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-theme');
    if (isDark) {
      enableLightMode();
    } else {
      enableDarkMode();
    }
  });

  function enableDarkMode() {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
    localStorage.setItem('tccane-theme', 'dark');
  }

  function enableLightMode() {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
    localStorage.setItem('tccane-theme', 'light');
  }
}

/* ==========================================================================
   2. Mobile Menu (Overlay Navigation)
   ========================================================================== */
function initMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileLinks = mobileMenu.querySelectorAll('.mobile-link, .mobile-cta');

  mobileMenuBtn.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.contains('open');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });

  function openMenu() {
    mobileMenuBtn.classList.add('open');
    mobileMenu.classList.add('open');
  }

  function closeMenu() {
    mobileMenuBtn.classList.remove('open');
    mobileMenu.classList.remove('open');
  }
}

/* ==========================================================================
   3. Accordion Handler (The 10 Precepts)
   ========================================================================== */
function initAccordion() {
  const accordionItems = document.querySelectorAll('#precepts-accordion .accordion-item');

  accordionItems.forEach(item => {
    const trigger = item.querySelector('.accordion-trigger');
    
    trigger.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all accordion items
      accordionItems.forEach(i => {
        i.classList.remove('active');
        i.querySelector('.accordion-trigger').setAttribute('aria-expanded', 'false');
      });
      
      // Toggle current item
      if (!isActive) {
        item.classList.add('active');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/* ==========================================================================
   4. Uniform Eligibility Tracker (Interactive Calculator)
   ========================================================================== */
function initUniformTracker() {
  const hoursInput = document.getElementById('hours-input');
  const eventCheckboxes = document.querySelectorAll('.event-type-chk');
  const retreatCheckbox = document.getElementById('retreat-chk');
  const advisorCheckbox = document.getElementById('advisor-chk');
  
  const progressBar = document.getElementById('tracker-progress');
  const progressPercentText = document.getElementById('tracker-percent');
  const statusBadge = document.getElementById('tracker-status-badge');
  const feedbackBox = document.getElementById('tracker-feedback-box');
  const feedbackText = document.getElementById('tracker-feedback-text');

  // Trigger recalculation on any input
  hoursInput.addEventListener('input', calculateProgress);
  hoursInput.addEventListener('change', calculateProgress);
  eventCheckboxes.forEach(chk => chk.addEventListener('change', calculateProgress));
  retreatCheckbox.addEventListener('change', calculateProgress);
  advisorCheckbox.addEventListener('change', calculateProgress);

  // Initial calculation
  calculateProgress();

  function calculateProgress() {
    const hours = parseInt(hoursInput.value) || 0;
    
    // 1. Calculate hours progress (Max 40 points)
    const hoursCompleted = Math.min(hours, 20);
    const hoursPoints = (hoursCompleted / 20) * 40;

    // 2. Calculate event types progress (Need 3 unique event types) (Max 20 points)
    let checkedEventsCount = 0;
    eventCheckboxes.forEach(chk => {
      if (chk.checked) checkedEventsCount++;
    });
    const eventsCompleted = Math.min(checkedEventsCount, 3);
    const eventsPoints = (eventsCompleted / 3) * 20;

    // 3. Retreat attendance (Max 20 points)
    const retreatPoints = retreatCheckbox.checked ? 20 : 0;

    // 4. Advisor approval (Max 20 points)
    const advisorPoints = advisorCheckbox.checked ? 20 : 0;

    // Sum total progress
    const totalProgress = Math.round(hoursPoints + eventsPoints + retreatPoints + advisorPoints);

    // Update DOM UI elements
    progressBar.style.width = `${totalProgress}%`;
    progressPercentText.textContent = `${totalProgress}%`;

    // Dynamic Status, Badges & Recommendations
    let statusText = "Inquirer";
    let badgeClass = "badge-success"; // We can reuse standard variables or dynamic classes
    let suggestions = [];

    // Calculate details for custom guidance
    if (hours < 20) {
      suggestions.push(`Volunteer ${20 - hours} more hours to reach the 20-hour benchmark.`);
    }
    if (checkedEventsCount < 3) {
      suggestions.push(`Complete service in ${3 - checkedEventsCount} more unique event types (e.g. Eco-Action, Tutoring).`);
    }
    if (!retreatCheckbox.checked) {
      suggestions.push("Attend at least one regional retreat, orientation, or conference.");
    }
    if (!advisorCheckbox.checked) {
      suggestions.push("Secure your chapter advisor's hour verification approval.");
    }

    // Determine eligibility levels
    if (totalProgress < 40) {
      statusText = "Inquirer";
      statusBadge.style.backgroundColor = "rgba(100, 123, 144, 0.15)";
      statusBadge.style.color = "var(--text-muted)";
    } else if (totalProgress >= 40 && totalProgress < 80) {
      statusText = "Candidate";
      statusBadge.style.backgroundColor = "rgba(245, 158, 11, 0.15)";
      statusBadge.style.color = "#D97706";
    } else if (totalProgress >= 80 && totalProgress < 100) {
      statusText = "Active Volunteer";
      statusBadge.style.backgroundColor = "rgba(16, 58, 92, 0.15)";
      statusBadge.style.color = "var(--primary)";
    } else if (totalProgress === 100) {
      statusText = "Tzu Ching Uniform Eligible";
      statusBadge.style.backgroundColor = "rgba(16, 185, 129, 0.15)";
      statusBadge.style.color = "#10B981";
    }

    statusBadge.textContent = statusText;

    // Formulate descriptive instructions in the notification box
    if (totalProgress === 100) {
      feedbackText.innerHTML = "<strong>Congratulations!</strong> You have satisfied all regional standards! You are fully eligible to submit your log and receive the official blue-and-white uniform.";
      feedbackBox.style.borderLeftColor = "#10B981";
      feedbackBox.style.backgroundColor = "rgba(16, 185, 129, 0.05)";
    } else {
      feedbackText.innerHTML = `<strong>Next Steps:</strong> ${suggestions[0] || "Uphold your precepts and complete your remaining checks!"}`;
      feedbackBox.style.borderLeftColor = "var(--primary)";
      feedbackBox.style.backgroundColor = "rgba(var(--primary-rgb), 0.05)";
    }
  }
}

/* ==========================================================================
   5. Campus & Community Chapters Filter
   ========================================================================== */
function initChaptersFilter() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const chapterCards = document.querySelectorAll('#chapters-grid .chapter-card');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active states on buttons
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');

      // Filter card displays
      chapterCards.forEach(card => {
        const cardType = card.getAttribute('data-type');
        
        if (filterValue === 'all' || cardType === filterValue) {
          // Fade in
          card.style.display = 'flex';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 50);
        } else {
          // Fade out
          card.style.opacity = '0';
          card.style.transform = 'translateY(10px)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 300);
        }
      });
    });
  });
}

/* ==========================================================================
   6. High-Fidelity Inquiry Form Simulation
   ========================================================================== */
function initInquiryForm() {
  const form = document.getElementById('inquiry-form');
  const successBox = document.getElementById('form-success');
  const resetBtn = document.getElementById('success-reset-btn');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Check validity
    if (!form.checkValidity()) return;

    // Simulate standard submission delay
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting Inquiries...';

    setTimeout(() => {
      // Reset button states
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;

      // Transition to Success Card Overlay
      successBox.classList.add('active');
      form.style.opacity = '0';
      
      // Extract form details for personalized feedback
      const studentName = document.getElementById('form-name').value;
      const purpose = document.getElementById('form-purpose').value;
      const responseParagraph = successBox.querySelector('p');

      if (purpose === 'hours') {
        responseParagraph.innerHTML = `Hi <strong>${studentName}</strong>, your hours verification request has been successfully dispatched to the regional database. Remember, hours verification requires <strong>2-4 weeks' notice</strong>. A copy of this has been sent to our regional advisors.`;
      } else if (purpose === 'reco') {
        responseParagraph.innerHTML = `Hi <strong>${studentName}</strong>, your Letter of Recommendation request has been submitted. Our chapter advisors will review your active status logs and reach out to you within 2-3 business days.`;
      } else {
        responseParagraph.innerHTML = `Hi <strong>${studentName}</strong>, thank you for reaching out to TCCANE. A copy of your inquiry has been logged. Our chapter advisors will reach out to you shortly to get you connected!`;
      }
    }, 1000);
  });

  resetBtn.addEventListener('click', () => {
    // Reset Form
    form.reset();
    
    // Animate transition back to form
    successBox.classList.remove('active');
    setTimeout(() => {
      form.style.opacity = '1';
    }, 200);
  });
}

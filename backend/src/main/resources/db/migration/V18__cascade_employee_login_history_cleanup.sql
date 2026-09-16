ALTER TABLE employee_login_events
    DROP FOREIGN KEY fk_employee_login_event_employee;

ALTER TABLE employee_login_events
    ADD CONSTRAINT fk_employee_login_event_employee
        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE;

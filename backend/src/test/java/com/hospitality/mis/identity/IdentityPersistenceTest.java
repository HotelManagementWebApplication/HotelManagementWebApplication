package com.hospitality.mis.identity;



import com.hospitality.mis.dao.identity.EmployeeRepository;

import com.hospitality.mis.entity.identity.Employee;

import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.identity.EmployeeRole;
import jakarta.persistence.Column;

import jakarta.persistence.JoinColumn;

import jakarta.persistence.Entity;

import jakarta.persistence.ManyToOne;

import jakarta.persistence.OneToMany;

import jakarta.persistence.Table;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;



import java.lang.reflect.Field;



import static org.assertj.core.api.Assertions.assertThat;



@DataJpaTest(properties = {

        "spring.datasource.url=jdbc:h2:mem:identitymapping;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",

        "spring.datasource.username=sa",

        "spring.datasource.password=",

        "spring.flyway.enabled=false",

        "spring.jpa.hibernate.ddl-auto=create-drop"

})

/** Bảo vệ mapping JPA Employee và quan hệ owner với Reservation theo schema canonical. */
class IdentityPersistenceTest {

    @Autowired

    /** Repository thật để kiểm tra round-trip employee trên H2. */
    EmployeeRepository employees;



    @Test

    /** Given employee đầy đủ, When save/reload, Then các field canonical không đổi. */
    void employeeRepositoryPersistsCanonicalEmployeeSchema() {
        Employee employee = new Employee();
        employee.setEmployeeId("ID01");
        employee.setFullName("Identity Employee");
        employee.setPassword("$2a$12$" + "A".repeat(53));
        employee.setRole(EmployeeRole.FRONT_DESK);
        employee.setAddress("Front desk");
        employee.setPhone("0909000001");


        Employee saved = employees.saveAndFlush(employee);



        assertThat(saved.getEmployeeId()).isEqualTo("ID01");

        assertThat(saved.getFullName()).isEqualTo("Identity Employee");

        assertThat(saved.getRole()).isEqualTo(EmployeeRole.FRONT_DESK);
        assertThat(employees.findById("ID01")).get()

                .extracting(Employee::getPhone)

                .isEqualTo("0909000001");

    }



    @Test

    /** Given entity/relationship annotations, When phản chiếu mapping, Then owner và constraint đúng schema. */
    void employeeIsTheConcreteJpaOwner() throws Exception {
        assertThat(Employee.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(Employee.class.getAnnotation(Table.class).name()).isEqualTo("NhanVien");

        assertColumn("employeeId", "maNhanVien", 10);
        assertColumn("fullName", "hoVaTen", 100);
        assertColumn("password", "matKhau", 255);
        assertColumn("role", "vaiTro", 30);
        assertColumn("address", "diaChi", 255);
        assertColumn("phone", "soDienThoai", 15);

        Column phone = Employee.class.getDeclaredField("phone").getAnnotation(Column.class);
        assertThat(phone.nullable()).isFalse();
        assertThat(phone.unique()).isTrue();


        Field reservationEmployee = Reservation.class.getDeclaredField("employee");
        assertThat(reservationEmployee.getType()).isEqualTo(Employee.class);
        assertThat(reservationEmployee.getAnnotation(ManyToOne.class)).isNotNull();

        assertThat(reservationEmployee.getAnnotation(JoinColumn.class).name()).isEqualTo("maNhanVien");


        Field employeeReservations = Employee.class.getDeclaredField("reservations");

        OneToMany inverse = employeeReservations.getAnnotation(OneToMany.class);

        assertThat(inverse).isNotNull();

        assertThat(inverse.mappedBy()).isEqualTo("employee");
        assertThat(inverse.cascade()).isEmpty();

        assertThat(inverse.orphanRemoval()).isFalse();

    }



    /** Assertion helper dùng length > 0 để chỉ kiểm tra các cột có giới hạn explicit. */
    private void assertColumn(String fieldName, String columnName, int length) throws Exception {

        Column column = Employee.class.getDeclaredField(fieldName).getAnnotation(Column.class);

        assertThat(column).as(fieldName).isNotNull();

        assertThat(column.name()).isEqualTo(columnName);

        if (length > 0) {

            assertThat(column.length()).isEqualTo(length);

        }

    }

}
